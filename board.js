/* ============================================================
   Erelijst — gedeeld tussen de clubspellen
   Twee opslagplaatsen achter dezelfde deur:
     local    — localStorage, ieder op zijn eigen toestel
     supabase — één gedeelde ranglijst voor heel de club
   Welk spel het is, staat in config.js; zo kunnen meerdere
   spellen dezelfde tabel delen zonder elkaars lijst te vullen.
   ============================================================ */
window.PipsBoard = (() => {
'use strict';

const CFG   = (window.PIPSOUT && window.PIPSOUT.leaderboard) || {};
const LIMIT = CFG.limit || 25;
const GAME  = CFG.game || 'pipsout';
const KEY   = 'ttcw_board_' + GAME;
const KEEP  = 60;

const useRemote = CFG.provider === 'supabase' && !!CFG.url && !!CFG.key;

/* ---------- welke dag is het? ----------
   Niet volgens de klok van het toestel, maar volgens die van Wielsbeke.
   Anders krijgt wie op reis is een andere dag te zien dan de rest van de
   club, en klopt de ranglijst van vandaag voor hem niet. */
const TZ = 'Europe/Brussels';

function offsetMs(d){
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = {};
  for (const deel of dtf.formatToParts(d)) p[deel.type] = deel.value;
  const alsUTC = Date.UTC(+p.year, +p.month - 1, +p.day,
                          p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second);
  return alsUTC - d.getTime();
}

/* middernacht van vandaag, in gewone epoch-milliseconden */
function dagStart(d){
  const nu = d || new Date();
  try {
    const off = offsetMs(nu);
    const klok = new Date(nu.getTime() + off);
    const mid = Date.UTC(klok.getUTCFullYear(), klok.getUTCMonth(), klok.getUTCDate());
    // op de nacht dat het uur verzet wordt, is de offset om middernacht een
    // andere dan die van nu; één keer bijstellen zet dat recht
    return mid - offsetMs(new Date(mid - off));
  } catch (_){
    const l = new Date(nu); l.setHours(0, 0, 0, 0);   // oude browser: lokale klok
    return l.getTime();
  }
}

function dagNaam(d){
  try {
    return new Intl.DateTimeFormat('nl-BE', { timeZone: TZ, day: 'numeric', month: 'long' })
      .format(d || new Date());
  } catch (_){ return ''; }
}

/* ---------- namen: kort, zonder rommel ---------- */
function cleanName(raw){
  return String(raw || '')
    .split('').filter(c => c >= ' ').join('')   // stuurtekens eruit
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

/* ---------- kan die score wel bij dat niveau horen? ---------- */
const PER = CFG.maxPerLevel || 30000;
const maxFor = level => PER * level * (level + 1);

const plausible = (score, level) =>
  Number.isFinite(score) && Number.isFinite(level) &&
  score >= 0 && level >= 1 && level <= 99 &&
  score <= maxFor(level);

/* ---------- lokale opslag ---------- */
function readLocal(){
  try {
    const rows = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(rows) ? rows.filter(r => r && plausible(r.score, r.level)) : [];
  } catch (_){ return []; }
}
function writeLocal(rows){
  try { localStorage.setItem(KEY, JSON.stringify(rows.slice(0, KEEP))); }
  catch (_){ /* privémodus: dan maar niet */ }
}
function addLocal(e){
  const rows = readLocal();
  rows.push(e);
  rows.sort((a, b) => b.score - a.score);
  writeLocal(rows);
}

/* ---------- alleen de beste score per naam ---------- */
function bestPerName(rows){
  const seen = new Map();
  for (const r of rows){
    const k = cleanName(r.name).toLowerCase();
    if (!k) continue;
    if (!seen.has(k) || seen.get(k).score < r.score) seen.set(k, r);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, LIMIT);
}

/* ---------- Supabase, via gewone REST ---------- */
const rest = {
  url(q){
    return String(CFG.url).replace(/\/+$/, '') +
           '/rest/v1/' + (CFG.table || 'scores') + (q || '');
  },
  head(extra){
    return Object.assign({
      apikey: CFG.key,
      Authorization: 'Bearer ' + CFG.key,
      'Content-Type': 'application/json'
    }, extra || {});
  },
  async top(sinds){
    const r = await fetch(
      this.url('?select=name,score,level,ts&game=eq.' + encodeURIComponent(GAME) +
               (sinds ? '&ts=gte.' + sinds : '') +
               '&order=score.desc&limit=' + (LIMIT * 4)),
      { headers: this.head() }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return bestPerName(await r.json());
  },
  async insert(e){
    const r = await fetch(this.url(), {
      method: 'POST',
      headers: this.head({ Prefer: 'return=minimal' }),
      body: JSON.stringify(Object.assign({ game: GAME }, e))
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  }
};

return {
  isRemote: useRemote,
  game: GAME,
  cleanName,
  plausible,
  maxFor,

  dagStart,
  dagNaam,

  /* {rows, remote, offline, vandaag} — offline betekent: de gedeelde lijst
     was niet bereikbaar, dit is wat er lokaal staat.
     opts.vandaag houdt enkel de scores van vandaag over. */
  async top(opts){
    const vandaag = !!(opts && opts.vandaag);
    const sinds = vandaag ? dagStart() : 0;
    const lokaal = () => bestPerName(readLocal().filter(r => !sinds || r.ts >= sinds));

    if (!useRemote) return { rows: lokaal(), remote: false, offline: false, vandaag };
    try {
      return { rows: await rest.top(sinds), remote: true, offline: false, vandaag };
    } catch (_){
      return { rows: lokaal(), remote: true, offline: true, vandaag };
    }
  },

  /* {entry, rank, offline} of null als de score niet kan kloppen. */
  async submit(name, score, level){
    const e = {
      name: cleanName(name) || 'Anoniem',
      score: Math.round(score),
      level: Math.round(level),
      ts: Date.now()
    };
    if (!plausible(e.score, e.level)) return null;

    addLocal(e);                       // altijd, ook als versturen mislukt

    if (!useRemote){
      const rank = bestPerName(readLocal()).findIndex(r => r.ts === e.ts) + 1;
      return { entry: e, rank, offline: false };
    }

    try {
      await rest.insert(e);
      const rows = await rest.top();
      return { entry: e, rank: rows.findIndex(r => r.ts === e.ts) + 1, offline: false };
    } catch (_){
      return { entry: e, rank: 0, offline: true };
    }
  },

  clear(){ try { localStorage.removeItem(KEY); } catch (_){} }
};

})();
