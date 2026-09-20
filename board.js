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
  async top(){
    const r = await fetch(
      this.url('?select=name,score,level,ts&game=eq.' + encodeURIComponent(GAME) +
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

  /* {rows, remote, offline} */
  async top(){
    if (!useRemote) return { rows: bestPerName(readLocal()), remote: false, offline: false };
    try {
      return { rows: await rest.top(), remote: true, offline: false };
    } catch (_){
      return { rows: bestPerName(readLocal()), remote: true, offline: true };
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
