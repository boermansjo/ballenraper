/* ============================================================
   BALLENRAPER  —  TTC Wielsbeke-Spotit
   Raap alle ballen op na de training. Je buis groeit mee.
   Geen frameworks, geen assets, geen server.
   ============================================================ */
(() => {
'use strict';

/* ---------- raster ---------- */
const CELL = 20;
const COLS = 22, ROWS = 26;
const W = COLS * CELL, H = ROWS * CELL;      // 440 x 520

/* middenstuk waar nooit een tafel komt, zodat je altijd
   veilig kan herstarten na een botsing */
const SAFE = { x0: 8, y0: 10, x1: 13, y1: 16 };

/* De buis houdt vierentwintig ballen, net als het echte ding. Vol is vol:
   wat er daarna nog binnenkomt, ketst eraf. Leeg is BASIS lang. */
const BUIS  = 24;
const BASIS = 3;

/* Hoe rap de buis vooruitschuift, in milliseconden per cel. TRAAGSTE is
   de start, RAPSTE is het plafond, en per geraapte bal gaat er PER_BAL
   af. Dit zijn de drie knoppen voor het speeltempo; ze staan nergens
   anders in de code. Het plafond wordt bereikt na (TRAAGSTE - RAPSTE) /
   PER_BAL ballen — en omdat je met de kar veel langer doorspeelt dan
   vroeger, zit je daar het grootste deel van een partij. */
const TRAAGSTE = 155;
const RAPSTE   = 95;
const PER_BAL  = 1.2;
const tempo = () => Math.max(RAPSTE, TRAAGSTE - G.balls * PER_BAL);

const cv  = document.getElementById('game');
const ctx = cv.getContext('2d');

const $ = id => document.getElementById(id);
const el = {
  ballCount: $('ballCount'), buisFill: $('buisFill'),
  scoreDigits: $('scoreDigits'), hearts: $('hearts'),
  levelTag: $('levelTag'), tickText: $('tickText'), mute: $('mute'),
  title: $('screen-title'), how: $('screen-how'), table: $('screen-table'),
  over: $('screen-over'), board: $('screen-board'),
  tableQuip: $('tableQuip'), tableCount: $('tableCount'), tableTitle: $('tableTitle'),
  tableBalls: $('tableBalls'), tableBonus: $('tableBonus'),
  overQuip: $('overQuip'), finalScore: $('finalScore'), bestOver: $('bestOver'),
  boardList: $('boardList'), boardNote: $('boardNote'), dagNaam: $('dagNaam'),
  tabDag: $('tabDag'), tabAlles: $('tabAlles'),
  submitRow: $('submitRow'), submitDone: $('submitDone'), playerName: $('playerName')
};

/* ============================================================
   TEKST
   ============================================================ */
const HEADLINES = [
  'Jeugdspeler raapt 400 ballen en vraagt beleefd om een ballenrobot.',
  'Trainer gooit mand om, kijkt rond, fluit onschuldig.',
  'Bal onder de radiator na twintig jaar teruggevonden.',
  'Bestuur onderzoekt aankoop van ballenbuis met dubbele capaciteit.',
  'Speler struikelt over eigen ballenbuis, blesseert enkel zijn ego.',
  'Oranje ballen blijken al jaren de snelste van de zaal.',
  'Materiaalcommissie telt de ballen. Er ontbreken er zeventien.',
  'Kantine sluit pas als de laatste bal geraapt is. Kantine sluit laat.',
  'Clubgenoot wandelt dwars door de zaal, ziet niemand, groet niemand.',
  'Nieuwe regel: wie het laatst klaar is, plooit de tafels.',
  'Celluloid bal uit 1987 gevonden achter de radiator. Museum belt niet terug.',
  'Trainer fluit. Niemand weet waarvoor, iedereen loopt rapper.',
  'Ballenkar staat nooit waar je ze gelaten hebt. Onderzoek loopt.',
  'Speler leegt buis naast de kar in plaats van erin. Mag herbeginnen.',
  'Materiaalploeg vraagt tweede ballenkar. Bestuur vraagt eerst de rekening.',
  'Zaal staat bij iedereen gelijk opgesteld. Uitvluchten worden niet meer aanvaard.',
  'Speler beweert dat zijn zaal moeilijker stond. Zaal stond bij iedereen hetzelfde.'
];

const TABLE_QUIPS = [
  'Er komt een tafel bij. Natuurlijk komt er een tafel bij.',
  'De jeugdtraining begint. Veel plezier.',
  'Nog een tafel. Nog meer poten om tegenaan te rijden.',
  'Iemand heeft een tafel opengeplooid en is dan vertrokken.',
  'De zaal vult zich. Jouw buis ook.',
  'Tafel erbij, ruimte eraf. Zo werkt dat.'
];

const FENCE_QUIPS = [
  'De vakken worden afgeschermd. Alsof het hier niet krap genoeg was.',
  'Sponsorborden. Iemand moet die centen toch verdienen.',
  'Er staat weer een bord in de weg. Rijd er maar omheen.',
  'De omheining staat recht. Jouw route niet meer.'
];

const OVER_QUIPS = [
  'Je struikelde over je eigen ballenbuis. Iedereen zag het.',
  'De tafelpoot stond daar al twintig jaar.',
  'De zijlijn is ook een lijn, blijkt.',
  'Sorry tegen je clubgenoot gezegd? Dacht het niet.',
  'De rest zit al in de kantine.',
  'Morgen weer een training, morgen weer ballen.',
  'Tegen de omheining. Die stond er al voor jij lid werd.'
];

const pick = a => a[(Math.random() * a.length) | 0];

/* ============================================================
   GELUID
   ============================================================ */
const Snd = {
  ac: null, on: true, noise: null,
  init(){
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    const len = this.ac.sampleRate * 0.25;
    this.noise = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  },
  env(node, vol, dur){
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, this.ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ac.currentTime + dur);
    node.connect(g); g.connect(this.ac.destination);
  },
  tone(type, from, to, vol, dur, delay){
    if (!this.on) return; this.init(); if (!this.ac) return;
    const t = this.ac.currentTime + (delay || 0);
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  pick(n){ this.tone('triangle', 420 + Math.min(n, 30) * 12, 220, 0.14, 0.08); },
  gold(){ [660, 990, 1320].forEach((f, i) => this.tone('square', f, null, 0.08, 0.14, i * 0.06)); },
  table(){ [392, 523, 659, 784].forEach((f, i) => this.tone('square', f, null, 0.09, 0.26, i * 0.08)); },
  bonk(){
    if (!this.on) return; this.init(); if (!this.ac) return;
    this.tone('sawtooth', 180, 50, 0.2, 0.3);
    const s = this.ac.createBufferSource(); s.buffer = this.noise;
    const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    s.connect(f); this.env(f, 0.25, 0.2); s.start(); s.stop(this.ac.currentTime + 0.2);
  },
  door(){
    this.tone('sine', 320, 1000, 0.10, 0.18);
    this.tone('sine', 640, 1500, 0.06, 0.22, 0.05);
  },
  dead(){ [392, 330, 262, 196].forEach((f, i) => this.tone('square', f, null, 0.1, 0.42, i * 0.16)); },

  /* het fluitje van de trainer: twee korte stoten, hoog en scherp */
  fluit(){
    [0, 0.17].forEach(d => {
      this.tone('square', 2100, 2500, 0.05, 0.13, d);
      this.tone('square', 3150, 3600, 0.02, 0.13, d);
    });
  },

  /* de buis in de kar leeggieten: een ratelende stroom balletjes */
  dump(){
    if (!this.on) return; this.init(); if (!this.ac) return;
    const s = this.ac.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.6;
    const f = this.ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.2;
    s.connect(f); this.env(f, 0.24, 0.45);
    s.start(); s.stop(this.ac.currentTime + 0.45);
    [523, 659, 784, 1047].forEach((n, i) => this.tone('triangle', n, null, 0.07, 0.2, i * 0.07));
  },

  /* een bal die uit een volle buis ketst */
  spill(){
    [220, 180].forEach((n, i) => this.tone('triangle', n, n * 0.7, 0.1, 0.12, i * 0.09));
  },

  celluloid(){
    [784, 988, 1175, 1568, 2093].forEach((n, i) => this.tone('sine', n, null, 0.07, 0.22, i * 0.05));
  }
};

/* ============================================================
   SPELSTAAT
   ============================================================ */
const G = {
  screen: 'title',
  snake: [], dir: { x: 0, y: -1 }, queue: [],
  balls: 0, score: 0, lives: 3, level: 1,
  tables: [], barriers: [], mates: [], doors: [], doorFx: 0,
  food: null, gold: null, cell: null,
  kar: null, inBuis: 0, karFx: 0, lossing: 0,
  plan: null, teDoen: [], omhTeDoen: [],
  fluit: 0, fluitIn: 20,
  step: TRAAGSTE,
  grow: 0, invuln: 0, waiting: true, frac: 0, grew: false,
  suck: 0, turnFx: 0,
  parts: [], texts: [], shake: 0, flash: 0,
  best: +(localStorage.getItem('ttcw_best_ballenraper') || 0)
};

const key = (x, y) => x + ',' + y;

/* ---------- is deze cel bezet? ---------- */
function blocked(x, y, opts){
  const o = opts || {};
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return 'muur';
  for (const t of G.tables){
    if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) return 'tafel';
  }
  for (const b of G.barriers){
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return 'omheining';
  }
  if (!o.skipMates){
    for (const m of G.mates) if (m.x === x && m.y === y) return 'clubgenoot';
  }
  if (!o.skipSnake){
    const n = G.snake.length;
    for (let i = 0; i < n; i++){
      // de staartpunt schuift weg in dezelfde tik, die telt niet mee
      if (o.ignoreTail && i === n - 1) continue;
      if (G.snake[i].x === x && G.snake[i].y === y) return 'jezelf';
    }
  }
  return null;
}

/* ============================================================
   DE ZAAL VAN VANDAAG
   Iedereen speelt dezelfde zaal: de eerste tafel van vandaag staat
   voor heel de club op dezelfde plek, de tweede ook, en zo verder.
   Dat vraagt geen server. Een gewone toevalsgenerator geeft elke keer
   iets anders, maar een gezaaide generator geeft altijd dezelfde reeks
   bij hetzelfde vertrekgetal — en dat vertrekgetal is gewoon de datum.

   Eén ding kan niet vooraf vastliggen: waar jíj op dat moment rijdt.
   Een tafel mag nooit pal voor je neus opengeplooid worden, en ze mag
   niet bovenop je buis staan. Daarom ligt er per beurt niet één plek
   klaar maar een handvol, en wordt de eerste genomen die kan. Zit de
   eerste je in de weg, dan schuift het naar de tweede — enkel voor jou,
   en enkel voor die ene tafel: het plan van de volgende tafels blijft
   hetzelfde. Zo loopt niemands zaal helemaal uit de pas.
   ============================================================ */
const KANDIDATEN = 8;

function hashSleutel(sleutel){
  let h = 2166136261;
  for (let i = 0; i < sleutel.length; i++) h = Math.imul(h ^ sleutel.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* mulberry32: klein, snel, en overal hetzelfde resultaat */
function generator(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function dagSleutel(){
  try {
    if (window.PipsBoard && PipsBoard.dagSleutel) return PipsBoard.dagSleutel();
  } catch (_){}
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

/* De hele zaal wordt vooraf gelegd, in een lege zaal en zonder speler:
   acht tafels en zes omheiningen die onderling hun cel speling houden.
   Daardoor is de vers gelegde zaal voor iedereen dezelfde, wat er ook
   gebeurt tijdens het spelen.

   Bij het spelen worden ze één voor één onthuld. Ligt de eerstvolgende
   net op de plek waar jíj rijdt, dan schuift ze naar achter en komt er
   eentje van verderop in de plaats. Je krijgt dus dezelfde acht tafels
   als de rest van de club, af en toe in een andere volgorde — en tegen
   het einde staat ieders zaal er identiek bij. */
function botst(a, b, speling){
  return a.x - speling < b.x + b.w && a.x + a.w + speling > b.x &&
         a.y - speling < b.y + b.h && a.y + a.h + speling > b.y;
}
function inHetMidden(a){
  return a.x < SAFE.x1 && a.x + a.w > SAFE.x0 && a.y < SAFE.y1 && a.y + a.h > SAFE.y0;
}

function maakPlan(sleutel){
  const r = generator(hashSleutel(sleutel));
  const tafels = [], omheiningen = [];

  const past = a => !inHetMidden(a) &&
    !tafels.some(b => botst(a, b, 1)) && !omheiningen.some(b => botst(a, b, 1));

  for (let n = 0; n < 8; n++){
    for (let t = 0; t < 600; t++){
      const a = { x: 1 + ((r() * (COLS - 4 - 2)) | 0), y: 1 + ((r() * (ROWS - 2 - 2)) | 0), w: 4, h: 2 };
      if (past(a)){ tafels.push(a); break; }
    }
  }
  for (let n = 0; n < 6; n++){
    for (let t = 0; t < 600; t++){
      const lang = 3 + ((r() * 3) | 0);
      const rechtop = r() < 0.5;
      const w = rechtop ? 1 : lang, h = rechtop ? lang : 1;
      const a = { x: 1 + ((r() * (COLS - w - 2)) | 0), y: 1 + ((r() * (ROWS - h - 2)) | 0), w, h };
      if (past(a)){ omheiningen.push(a); break; }
    }
  }

  /* Deuren en karplekken worden getoetst aan de vólle zaal. Wat daar
     past, past ook in een zaal waar nog maar de helft van staat, dus
     kloppen ze op elk niveau. */
  const vrijInVolleZaal = (x, y, w, h, speling) => {
    const a = { x, y, w: w || 1, h: h || 1 };
    return !tafels.some(b => botst(a, b, speling)) && !omheiningen.some(b => botst(a, b, speling));
  };

  const deuren = [];
  for (let n = 0; n < 24; n++){
    const lijst = [];
    for (let k = 0; k < 40 && lijst.length < KANDIDATEN; k++){
      const zijde = (r() * 4) | 0;
      const d = zijde === 0 ? { x: 0,        y: 2 + ((r() * (ROWS - 4)) | 0), zijde: 'links'  }
              : zijde === 1 ? { x: COLS - 1, y: 2 + ((r() * (ROWS - 4)) | 0), zijde: 'rechts' }
              : zijde === 2 ? { x: 2 + ((r() * (COLS - 4)) | 0), y: 0,        zijde: 'boven'  }
              :               { x: 2 + ((r() * (COLS - 4)) | 0), y: ROWS - 1, zijde: 'onder'  };
      const inz = INWAARTS[d.zijde];
      // de deur zelf vrij, en de cel ervóór ook, anders kom je er niet uit
      if (!vrijInVolleZaal(d.x, d.y, 1, 1, 1)) continue;
      if (!vrijInVolleZaal(d.x + inz.x, d.y + inz.y, 1, 1, 0)) continue;
      lijst.push(d);
    }
    deuren.push(lijst);
  }

  const karren = [];
  for (let n = 0; n < 80; n++){
    const lijst = [];
    // in een volle zaal is een vrij plekje van twee bij twee schaars,
    // dus geven we de generator hier wat meer pogingen
    for (let k = 0; k < 250 && lijst.length < KANDIDATEN; k++){
      const x = 1 + ((r() * (COLS - 3)) | 0), y = 1 + ((r() * (ROWS - 3)) | 0);
      const a = { x, y, w: 2, h: 2 };
      if (inHetMidden(a)) continue;
      if (!vrijInVolleZaal(x, y, 2, 2, 1)) continue;
      lijst.push({ x, y });
    }
    karren.push(lijst);
  }

  return { sleutel, tafels, omheiningen, deuren, karren };
}

/* ---------- de ballenkar ----------
   Twee bij twee cellen, en je rijdt er gewoon in: ze houdt je niet tegen,
   ze neemt je buis over. Na elke lossing rolt iemand ze ergens anders. */
function karAt(x, y){
  return !!G.kar && x >= G.kar.x && x < G.kar.x + 2 && y >= G.kar.y && y < G.kar.y + 2;
}
function karZone(x, y){
  return !!G.kar && x >= G.kar.x - 1 && x <= G.kar.x + 2 &&
                    y >= G.kar.y - 1 && y <= G.kar.y + 2;
}

function karKan(x, y, verboden, kop){
  if (x < 1 || y < 1 || x > COLS - 3 || y > ROWS - 3) return false;
  // het midden blijft leeg, daar herstart je
  if (x < SAFE.x1 && x + 2 > SAFE.x0 && y < SAFE.y1 && y + 2 > SAFE.y0) return false;
  // ver genoeg weg, anders is het geen ritje
  if (Math.abs(kop.x - x) + Math.abs(kop.y - y) < 6) return false;

  // een cel speling rond de kar, zodat je er altijd aan kan
  for (let yy = y - 1; yy <= y + 2; yy++){
    for (let xx = x - 1; xx <= x + 2; xx++){
      const wat = blocked(xx, yy, { skipSnake: true, skipMates: true });
      if (wat === 'tafel' || wat === 'omheining') return false;
    }
  }

  for (let yy = y; yy < y + 2; yy++){
    for (let xx = x; xx < x + 2; xx++){
      if (blocked(xx, yy, { skipMates: true })) return false;
      if (verboden.has(xx + ',' + yy)) return false;
      if (doorAt(xx, yy)) return false;
      if (G.food && G.food.x === xx && G.food.y === yy) return false;
      if (G.gold && G.gold.x === xx && G.gold.y === yy) return false;
      if (G.cell && G.cell.x === xx && G.cell.y === yy) return false;
    }
  }
  return true;
}

function placeKar(){
  const verboden = baanVoorJe();
  const kop = G.snake[0] || { x: (COLS / 2) | 0, y: (ROWS / 2) | 0 };

  // eerst de plek die vandaag aan de beurt is
  const plan = G.plan && G.plan.karren[G.lossing % G.plan.karren.length];
  for (const k of (plan || [])){
    if (karKan(k.x, k.y, verboden, kop)){ G.kar = { x: k.x, y: k.y }; return true; }
  }
  // stond je daar net allemaal in de weg: dan maar zelf zoeken
  for (let tries = 0; tries < 500; tries++){
    const x = 1 + ((Math.random() * (COLS - 3)) | 0);
    const y = 1 + ((Math.random() * (ROWS - 3)) | 0);
    if (karKan(x, y, verboden, kop)){ G.kar = { x, y }; return true; }
  }
  return false;                    // geen plek: de kar blijft staan waar ze staat
}

function freeCell(){
  for (let tries = 0; tries < 400; tries++){
    const x = (Math.random() * COLS) | 0;
    const y = (Math.random() * ROWS) | 0;
    if (blocked(x, y)) continue;
    if (doorAt(x, y)) continue;
    if (karAt(x, y)) continue;
    if (G.food && G.food.x === x && G.food.y === y) continue;
    if (G.gold && G.gold.x === x && G.gold.y === y) continue;
    if (G.cell && G.cell.x === x && G.cell.y === y) continue;
    // niet pal voor de neus laten verschijnen
    const h = G.snake[0];
    if (h && Math.abs(h.x - x) + Math.abs(h.y - y) < 3) continue;
    return { x, y };
  }
  // zaal bijna vol: neem dan maar de eerste vrije cel die er is
  for (let y = 0; y < ROWS; y++){
    for (let x = 0; x < COLS; x++){
      if (blocked(x, y)) continue;
      if (G.food && G.food.x === x && G.food.y === y) continue;
      if (G.gold && G.gold.x === x && G.gold.y === y) continue;
      if (G.cell && G.cell.x === x && G.cell.y === y) continue;
      return { x, y };
    }
  }
  return null;
}

/* ---------- de cellen recht vóór je, die blijven vrij ----------
   Standaard zes cellen ver. Bij een nieuwe tafel of omheining volstaan er
   drie: daar valt het spel stil met een tussenscherm en vertrek je pas
   weer als je zelf veegt, dus je ziet wat er staat voor je rijdt. Minder
   cellen betekent dat de tafel die aan de beurt is vaker ook effectief
   aan de beurt komt, en ieders zaal dus gelijker loopt. */
function baanVoorJe(ver){
  const set = new Set();
  const kop = G.snake[0];
  if (!kop) return set;
  const diep = ver || 6;
  for (let k = 0; k <= diep; k++){
    const bx = kop.x + G.dir.x * k, by = kop.y + G.dir.y * k;
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        set.add((bx + ox) + ',' + (by + oy));
  }
  return set;
}

/* ---------- twee deuren van de zaal ----------
   Vanaf drie tafels staan er twee deuren open: rij je de ene binnen,
   dan kom je de andere uit. Ze verhuizen bij elke nieuwe tafel. */
const INWAARTS = {
  links:  { x:  1, y:  0 },
  rechts: { x: -1, y:  0 },
  boven:  { x:  0, y:  1 },
  onder:  { x:  0, y: -1 }
};

function doorAt(x, y){ return G.doors.find(d => d.x === x && d.y === y); }

function placeDoors(){
  G.doors = [];
  if (G.tables.length < 3) return;
  const verboden = baanVoorJe();
  const gekozen = [];

  /* Een deur zit in een muur, niet midden in de zaal. We kiezen dus een
     cel op de rand, en onthouden tegen welke muur ze staat: daar komt de
     rijrichting uit voort als je er weer uit rijdt. Hoeken slaan we over,
     want daar sta je meteen klem. */
  const opDeRand = () => {
    const zijde = (Math.random() * 4) | 0;
    if (zijde === 0) return { x: 0,        y: 2 + ((Math.random() * (ROWS - 4)) | 0), zijde: 'links'  };
    if (zijde === 1) return { x: COLS - 1, y: 2 + ((Math.random() * (ROWS - 4)) | 0), zijde: 'rechts' };
    if (zijde === 2) return { x: 2 + ((Math.random() * (COLS - 4)) | 0), y: 0,        zijde: 'boven'  };
    return                   { x: 2 + ((Math.random() * (COLS - 4)) | 0), y: ROWS - 1, zijde: 'onder'  };
  };

  const deurKan = (kand) => {
    const x = kand.x, y = kand.y;
    if (blocked(x, y)) return false;
    if (verboden.has(x + ',' + y)) return false;
    if (karZone(x, y)) return false;
    if (G.food && G.food.x === x && G.food.y === y) return false;
    // ver genoeg uit elkaar, anders heb je er niets aan
    if (gekozen.some(d => Math.abs(d.x - x) + Math.abs(d.y - y) < 9)) return false;
    // niet tegen een tafel aan geplakt
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        if (blocked(x + ox, y + oy, { skipSnake: true, skipMates: true }) === 'tafel') return false;
    // en de cel vóór de deur moet vrij zijn, anders kom je er niet uit
    const inz = INWAARTS[kand.zijde];
    if (!inz) return false;
    if (blocked(x + inz.x, y + inz.y, { skipSnake: true })) return false;
    return true;
  };

  // de deuren van vandaag, per niveau
  const plan = G.plan && G.plan.deuren[Math.min(G.level, G.plan.deuren.length - 1)];
  for (const kand of (plan || [])){
    if (gekozen.length >= 2) break;
    if (deurKan(kand)) gekozen.push(kand);
  }
  while (gekozen.length < 2){
    let gevonden = false;
    for (let tries = 0; tries < 400 && !gevonden; tries++){
      const kand = opDeRand();
      if (deurKan(kand)){ gekozen.push(kand); gevonden = true; }
    }
    if (!gevonden) break;
  }
  if (gekozen.length === 2) G.doors = gekozen;   // half werk heeft geen zin
}

/* ---------- een tafel erbij ---------- */
function tafelKan(x, y, w, h, verboden){
  if (x < 1 || y < 1 || x + w > COLS - 1 || y + h > ROWS - 1) return false;

  // het midden vrijhouden om te kunnen herstarten
  if (x < SAFE.x1 && x + w > SAFE.x0 && y < SAFE.y1 && y + h > SAFE.y0) return false;

  // een cel speling rond tafels én omheiningen, anders sluit je een
  // doorgang af die er bij het plaatsen van die omheining nog was
  for (let yy = y - 1; yy <= y + h; yy++){
    for (let xx = x - 1; xx <= x + w; xx++){
      const wat = blocked(xx, yy, { skipMates: true });
      if (wat === 'tafel' || wat === 'omheining') return false;
      if (karZone(xx, yy)) return false;              // de kar blijft bereikbaar
    }
  }
  for (let yy = y; yy < y + h; yy++){
    for (let xx = x; xx < x + w; xx++){
      if (blocked(xx, yy, { skipMates: true })) return false;
      if (verboden.has(xx + ',' + yy)) return false;
    }
  }
  return true;
}

function addTable(){
  if (G.tables.length >= 8) return false;

  /* De baan recht voor je blijft vrij. Anders plooit iemand een tafel
     open op de plek waar jij net naartoe reed, en dan is het hartje weg
     voor je iets kan doen. */
  const verboden = baanVoorJe(3);
  const w = 4, h = 2;

  /* De eerste tafel uit het plan die nu kan. Stond je net op die plek,
     dan blijft ze in de wachtrij en komt er eentje van verderop eerst —
     dezelfde zaal, even een andere volgorde.

     Kan er géén enkele omdat ze allemaal in je baan liggen, dan nemen we
     de eerste toch. Beter een tafel in je baan dan een tafel die bij jou
     ergens anders staat dan bij de rest: het spel valt hier stil met een
     tussenscherm en vertrekt pas weer als je zelf veegt, dus je ziet ze
     staan voor je rijdt. */
  for (const negeerBaan of [false, true]){
    const baan = negeerBaan ? new Set() : verboden;
    for (let i = 0; i < G.teDoen.length; i++){
      const k = G.teDoen[i];
      if (tafelKan(k.x, k.y, w, h, baan)){
        G.teDoen.splice(i, 1);
        G.tables.push({ x: k.x, y: k.y, w, h });
        return true;
      }
    }
  }

  /* Ligt je buis op elke plek die nog te gaan is, dan plooien we deze
     keer niets open. Liever een keer geen tafel dan een tafel die bij
     jou ergens staat waar ze bij de rest van de club niet staat; acht
     ballen later is er weer plaats. */
  if (G.teDoen.length) return false;

  // alleen als het plan op is (zou niet mogen), zoeken we nog zelf
  for (let tries = 0; tries < 300; tries++){
    const x = 1 + ((Math.random() * (COLS - w - 2)) | 0);
    const y = 1 + ((Math.random() * (ROWS - h - 2)) | 0);
    if (tafelKan(x, y, w, h, verboden)){ G.tables.push({ x, y, w, h }); return true; }
  }
  return false;
}

/* ---------- een omheining erbij ----------
   De lage borden die de speelvakken afschermen: één baan breed en
   drie tot vijf lang. Ze houden altijd een cel speling van tafels en
   van elkaar, zodat er overal nog een doorgang blijft. */
function omheiningKan(x, y, w, h, verboden){
  if (x < 1 || y < 1 || x + w > COLS - 1 || y + h > ROWS - 1) return false;

  // het midden blijft vrij om te kunnen herstarten
  if (x < SAFE.x1 && x + w > SAFE.x0 && y < SAFE.y1 && y + h > SAFE.y0) return false;

  for (let yy = y - 1; yy <= y + h; yy++){
    for (let xx = x - 1; xx <= x + w; xx++){
      const wat = blocked(xx, yy, { skipSnake: true, skipMates: true });
      if (wat === 'tafel' || wat === 'omheining') return false;      // speling errond
      if (karZone(xx, yy)) return false;                             // en van de kar
    }
  }

  for (let yy = y; yy < y + h; yy++){
    for (let xx = x; xx < x + w; xx++){
      if (blocked(xx, yy, { skipMates: true })) return false;
      if (verboden.has(xx + ',' + yy)) return false;
      if (doorAt(xx, yy)) return false;
      // nooit pal voor een deur gaan staan
      for (const d of G.doors){
        const inz = INWAARTS[d.zijde];
        if (inz && d.x + inz.x === xx && d.y + inz.y === yy) return false;
      }
    }
  }
  return true;
}

function addBarrier(){
  if (G.barriers.length >= 6) return false;
  const verboden = baanVoorJe(3);

  for (const negeerBaan of [false, true]){
    const baan = negeerBaan ? new Set() : verboden;
    for (let i = 0; i < G.omhTeDoen.length; i++){
      const k = G.omhTeDoen[i];
      if (omheiningKan(k.x, k.y, k.w, k.h, baan)){
        G.omhTeDoen.splice(i, 1);
        G.barriers.push({ x: k.x, y: k.y, w: k.w, h: k.h });
        return true;
      }
    }
  }
  if (G.omhTeDoen.length) return false;      // straks opnieuw proberen

  for (let tries = 0; tries < 300; tries++){
    const lang = 3 + ((Math.random() * 3) | 0);
    const rechtop = Math.random() < 0.5;
    const w = rechtop ? 1 : lang, h = rechtop ? lang : 1;
    const x = 1 + ((Math.random() * (COLS - w - 2)) | 0);
    const y = 1 + ((Math.random() * (ROWS - h - 2)) | 0);
    if (omheiningKan(x, y, w, h, verboden)){ G.barriers.push({ x, y, w, h }); return true; }
  }
  return false;
}

/* ---------- clubgenoten die niet uitkijken ---------- */
function syncMates(){
  const want = Math.min(3, Math.max(0, G.tables.length - 2));
  while (G.mates.length > want) G.mates.pop();
  while (G.mates.length < want){
    const spot = freeCell();
    if (!spot) break;
    G.mates.push({ x: spot.x, y: spot.y, dx: Math.random() < 0.5 ? -1 : 1, t: 0 });
  }
}

function moveMates(){
  for (const m of G.mates){
    m.moved = false;
    m.t++;
    if (m.t % 3) continue;                       // trager dan jij
    const nx = m.x + m.dx;
    if (blocked(nx, m.y, { skipSnake: true, skipMates: true })){ m.dx *= -1; continue; }
    m.px = m.x; m.py = m.y; m.x = nx; m.moved = true;
  }
}

/* ============================================================
   SPEL
   ============================================================ */
function resetSnake(){
  const cx = (COLS / 2) | 0, cy = (ROWS / 2) | 0;
  G.snake = [{ x: cx, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy + 2 }];
  G.dir = { x: 0, y: -1 };
  G.queue = [];
  G.grow = 0;
  G.inBuis = 0;            // wat erin zat, ligt nu over de vloer
  G.invuln = 1.6;
  G.waiting = true;        // pas vertrekken als de speler zelf stuurt
  bumpBuis();
}

function startGame(){
  G.balls = 0; G.score = 0; G.lives = 3; G.level = 1;
  G.tables = []; G.barriers = []; G.mates = []; G.doors = [];
  G.food = null; G.gold = null; G.cell = null;
  G.kar = null; G.inBuis = 0; G.karFx = 0; G.lossing = 0;
  G.plan = maakPlan(dagSleutel());      // de zaal van vandaag, voor heel de club dezelfde
  G.teDoen = G.plan.tafels.slice();
  G.omhTeDoen = G.plan.omheiningen.slice();
  G.fluit = 0; G.fluitIn = 20;
  G.parts = []; G.texts = [];
  G.step = TRAAGSTE;
  resetSnake();
  addTable();
  placeKar();
  G.food = freeCell();
  drawHearts(); bumpScore(); bumpBalls();
  show('play');
}

function spawnFood(){
  G.food = freeCell();
  if (G.gold || G.cell) return;
  /* Een celluloid bal is zeldzaam: die lag al jaren achter de radiator. */
  if (Math.random() < 0.06){
    const c = freeCell();
    if (c){ G.cell = c; G.cell.life = 13; }
  } else if (Math.random() < 0.2){
    const g = freeCell();
    if (g){ G.gold = g; G.gold.life = 9; }
  }
}

/* Punten lopen dubbel zolang de trainer fluit. Geeft terug wat er
   effectief bijkwam, zodat het zwevende tekstje niet liegt. */
function punten(n){
  const p = n * (G.fluit > 0 ? 2 : 1);
  G.score += p;
  return p;
}

function eat(soort){
  G.suck = 1;

  if (soort === 'ster'){
    G.gold = null;
    addText('+' + punten(50), '#ffb43f');
    Snd.gold();
    bumpScore();
    return;                         // een 3-sterren bal gooi je in je zak, niet in je buis
  }

  if (soort === 'bal' && G.inBuis >= BUIS){
    /* De buis zit vol. De bal ketst eraf en rolt de zaal weer in: geen
       punten, geen groei. Rij naar de kar, dat is de hele boodschap. */
    spawnFood();
    addText('BUIS VOL!', '#ff9a8a');
    spill();
    Snd.spill();
    return;
  }

  if (soort === 'celluloid'){
    G.cell = null;
    G.balls++;
    bumpBalls();
    addText('CELLULOID +' + punten(150), '#ffe9a8');
    Snd.celluloid();
    // ze neemt plaats voor drie: zoveel als er nog in kan
    const erin = Math.min(3, BUIS - G.inBuis);
    G.inBuis += erin; G.grow += erin;
    if (erin < 3){ addText('BUIS VOL!', '#ff9a8a', -13); spill(); }
  } else {
    G.balls++;
    G.inBuis++;
    G.grow += 1;
    punten(10);
    bumpBalls();
    Snd.pick(G.snake.length);
    spawnFood();
  }

  bumpBuis();
  bumpScore();
  G.step = tempo();
  if (G.balls % 8 === 0) newTable();
}

/* een bal die uit de volle buis achteraan naar buiten rolt */
function spill(){
  const t = G.snake[G.snake.length - 1];
  if (t) burst(t, '#f4f7fa', 9);
}

/* ---------- de buis in de kar leeggieten ----------
   Twintig punten per bal, en tweehonderdvijftig extra als ze vol was.
   Vandaar het hele spel: hoe langer je doorgaat, hoe meer het opbrengt
   en hoe langer en onhandiger je wordt. */
function dumpBuis(){
  if (G.inBuis <= 0) return;
  const n = G.inBuis, vol = n >= BUIS;
  const bonus = punten(20 * n + (vol ? 250 : 0));

  G.inBuis = 0;
  G.grow = 0;
  while (G.snake.length > BASIS) G.snake.pop();
  G.queue.length = 0;

  addText('+' + bonus, vol ? '#ffd23f' : '#9ef0b4');
  if (vol) addText('VOLLE BUIS!', '#ffd23f', -13);
  G.karFx = 1;
  burst({ x: G.kar.x + 0.5, y: G.kar.y + 0.5 }, '#f4f7fa', 20);
  Snd.dump();
  bumpScore(); bumpBuis();
  G.lossing++;
  placeKar();                        // iemand rolt de kar ergens anders
}

/* ---------- het fluitje van de trainer ---------- */
function startFluit(){
  G.fluit = 5;
  addText('TRAINER FLUIT — DUBBELE PUNTEN', '#ffe37a');
  Snd.fluit();
  setTag();
}

/* Elke acht ballen komt er iets bij. Eerst worden de tafels opengeplooid;
   staat de zaal vol, dan beginnen ze de vakken af te schermen. */
function newTable(){
  /* Eerst de acht tafels, daarna pas de omheiningen. Lukt het nu niet —
     omdat je buis op de plek ligt die aan de beurt is — dan slaan we deze
     keer over in plaats van iets anders te verzinnen. */
  let soort = 'tafel';
  if (G.tables.length < 8){
    if (!addTable()) return;
  } else {
    if (!addBarrier()) return;      // zaal is af, verder niets
    soort = 'omheining';
  }
  G.level++;
  syncMates();
  placeDoors();

  const bonus = punten(100 * G.level);
  bumpScore();

  el.tableTitle.textContent = soort === 'tafel' ? 'TAFEL ERBIJ' : 'OMHEINING ERBIJ';
  el.tableCount.textContent = G.tables.length +
    (G.barriers.length ? ' + ' + G.barriers.length + ' omheining' + (G.barriers.length > 1 ? 'en' : '') : '');
  el.tableBalls.textContent = G.balls;
  el.tableBonus.textContent = bonus;
  el.tableQuip.textContent  = soort === 'tafel' ? pick(TABLE_QUIPS) : pick(FENCE_QUIPS);
  Snd.table();
  show('table');
}

function crash(reason){
  G.lives--;
  drawHearts();
  G.shake = 22; G.flash = 1;
  burst(G.snake[0], '#ff6b6b', 18);
  Snd.bonk();

  if (G.lives <= 0){ gameOver(reason); return; }
  addText(reason.toUpperCase(), '#ff9a8a');
  if (G.inBuis >= 6) addText(G.inBuis + ' BALLEN OVER DE VLOER', '#ffb0a0', -13);
  resetSnake();
}

function gameOver(reason){
  if (G.score > G.best){
    G.best = G.score;
    localStorage.setItem('ttcw_best_ballenraper', String(G.best));
  }
  const fin = String(G.score).padStart(6, '0');
  el.finalScore.textContent = fin;
  el.finalScore.classList.toggle('long',  fin.length === 7);
  el.finalScore.classList.toggle('vlong', fin.length > 7);
  el.overQuip.textContent = reason === 'jezelf' ? OVER_QUIPS[0]
                          : reason === 'tafel'  ? OVER_QUIPS[1]
                          : reason === 'muur'   ? OVER_QUIPS[2]
                          : reason === 'clubgenoot' ? OVER_QUIPS[3]
                          : reason === 'omheining'  ? OVER_QUIPS[6]
                          : pick(OVER_QUIPS);
  el.bestOver.textContent = G.best;
  el.submitRow.classList.toggle('hidden', G.score <= 0);
  el.submitDone.classList.add('hidden');
  el.playerName.value = localStorage.getItem('ttcw_name') || '';
  Snd.dead();
  show('over');
}

/* ---------- één tik ---------- */
function tick(){
  /* De trechter wordt tot een hele cel vooruit getekend, maar de bocht
     draait rond de cel waar de kop logisch staat. Veeg je laat in een
     stap, dan zag je de trechter al bij het volgende kruispunt staan en
     draaide hij een baan te vroeg. Zo'n veeg wachten we één tik af, dan
     valt de bocht op het kruispunt dat je zag. */
  if (G.queue.length){
    const d = G.queue[0];
    if (d.wacht > 0){
      d.wacht--;
    } else {
      G.queue.shift();
      if (d.x !== -G.dir.x || d.y !== -G.dir.y){
        if (d.x !== G.dir.x || d.y !== G.dir.y) G.turnFx = 1;   // even in elkaar duwen
        G.dir = { x: d.x, y: d.y };
      }
    }
  }

  const head = G.snake[0];
  const nx = head.x + G.dir.x, ny = head.y + G.dir.y;

  // een deur in? dan kom je bij de andere weer buiten
  let tx = nx, ty = ny;
  const deur = doorAt(nx, ny);
  if (deur){
    const uit = G.doors.find(d => d !== deur);
    tx = uit.x; ty = uit.y;
    // je komt een deuropening uit, dus de zaal in
    const inz = INWAARTS[uit.zijde] || G.dir;
    G.dir = { x: inz.x, y: inz.y };
    G.queue.length = 0;
    G.doorFx = 1;
    burst(deur, '#ffd98a', 10);
    burst(uit, '#ffd98a', 10);
    Snd.door();
  }

  // vlak na een herstart lopen clubgenoten even door je heen
  const hit = blocked(tx, ty, { ignoreTail: G.grow === 0, skipMates: G.invuln > 0 });
  if (hit){ crash(hit); return; }

  G.snake.unshift({ x: tx, y: ty });
  G.grew = G.grow > 0;
  if (G.grow > 0) G.grow--; else G.snake.pop();

  if (G.food && G.food.x === tx && G.food.y === ty) eat('bal');
  else if (G.gold && G.gold.x === tx && G.gold.y === ty) eat('ster');
  else if (G.cell && G.cell.x === tx && G.cell.y === ty) eat('celluloid');

  // de kar houdt je niet tegen, ze neemt je buis over
  if (karAt(tx, ty)) dumpBuis();

  moveMates();
  if (G.invuln <= 0){
    for (const m of G.mates){
      if (m.x === tx && m.y === ty){ crash('clubgenoot'); return; }
    }
  }
}

/* ============================================================
   SCHERMPJES
   ============================================================ */
function show(name){
  G.screen = name;
  for (const k of ['title', 'how', 'table', 'over', 'board']) el[k].classList.add('hidden');
  if (el[name]) el[name].classList.remove('hidden');
  el.levelTag.classList.toggle('hidden', name !== 'play');
  if (name === 'play') setTag();
}

/* het bandje bovenaan: normaal wat er in de zaal staat, en zolang de
   trainer fluit wat er dan te halen valt */
function setTag(){
  if (G.fluit > 0){
    el.levelTag.classList.add('fluit');
    el.levelTag.textContent = 'TRAINER FLUIT  ·  DUBBELE PUNTEN';
    return;
  }
  el.levelTag.classList.remove('fluit');
  el.levelTag.textContent = G.barriers.length
    ? G.tables.length + ' TAFELS  ·  ' + G.barriers.length + ' OMHEININGEN'
    : G.tables.length + ' TAFELS IN DE ZAAL';
}

function bumpScore(){
  const txt = String(G.score).padStart(6, '0');
  el.scoreDigits.textContent = txt;
  el.scoreDigits.classList.toggle('long',  txt.length === 7);
  el.scoreDigits.classList.toggle('vlong', txt.length > 7);
  el.scoreDigits.classList.remove('bump');
  void el.scoreDigits.offsetWidth;
  el.scoreDigits.classList.add('bump');
}
function bumpBalls(){ el.ballCount.textContent = String(G.balls).padStart(3, '0'); }

/* de meter naast je ballenteller: hoe vol de buis zit */
function bumpBuis(){
  const v = Math.min(1, G.inBuis / BUIS);
  el.buisFill.style.width = (v * 100).toFixed(1) + '%';
  el.buisFill.classList.toggle('warn', v >= 0.7 && v < 1);
  el.buisFill.classList.toggle('crit', v >= 1);
}

function drawHearts(){
  el.hearts.innerHTML = '';
  for (let i = 0; i < 3; i++){
    const h = document.createElement('div');
    h.className = 'heart' + (i < G.lives ? '' : ' gone');
    el.hearts.appendChild(h);
  }
}

function burst(c, col, n){
  const px = c.x * CELL + CELL / 2, py = c.y * CELL + CELL / 2;
  for (let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 160;
    G.parts.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50,
                   life: 0.5 + Math.random() * 0.4, max: 0.9, size: 2 + Math.random() * 3, col });
  }
}
function addText(t, col, dy){
  const h = G.snake[0];
  G.texts.push({ x: h.x * CELL + CELL / 2, y: h.y * CELL - 6 + (dy || 0), t, col, life: 1 });
}

/* ============================================================
   ERELIJST
   ============================================================ */
let boardFrom = 'title', boardToken = 0;
/* De erelijst opent op vandaag: daar zit de wedstrijd van de dag.
   Aller tijden staat er één knop naast. */
let boardVandaag = true;
let boardMine = 0;          // welke rij oplichten, ook na het wisselen van tab

function boardRow(cls, cells){
  const li = document.createElement('li');
  if (cls) li.className = cls;
  for (const [c, txt] of cells){
    const sp = document.createElement('span');
    sp.className = c;
    sp.textContent = txt;              // nooit innerHTML: namen komen van spelers
    li.appendChild(sp);
  }
  return li;
}

async function renderBoard(mineTs){
  const mine = ++boardToken;
  const list = el.boardList;
  el.tabDag.classList.toggle('on', boardVandaag);
  el.tabAlles.classList.toggle('on', !boardVandaag);
  list.textContent = '';
  list.appendChild(boardRow('leeg', [['', 'Laden…']]));
  el.boardNote.textContent = '';

  const res = await PipsBoard.top({ vandaag: boardVandaag });
  if (mine !== boardToken) return;

  list.textContent = '';
  if (!res.rows.length){
    list.appendChild(boardRow('leeg', [['',
      res.vandaag ? 'Vandaag nog niemand. Wees de eerste.' : 'Nog niemand. Wees de eerste.']]));
  } else {
    res.rows.forEach((r, i) => {
      list.appendChild(boardRow(mineTs && r.ts === mineTs ? 'me' : '', [
        ['rk', (i + 1) + '.'],
        ['nm', r.name],
        ['sc', String(r.score).padStart(6, '0')],
        ['lv', 'niveau ' + r.level]
      ]));
    });
  }

  const dag = PipsBoard.dagNaam();
  el.boardNote.textContent =
    res.offline ? 'Geen verbinding met de clubranking. Dit is de lijst op dit toestel.'
    : !res.remote ? (res.rows.length ? 'Deze lijst staat op dit toestel.'
                                     : 'Speel een partij en zet je naam erbij.')
    : res.vandaag ? 'De ranglijst van vandaag' + (dag ? ', ' + dag : '') + '. Om middernacht begint alles opnieuw.'
    : 'Alles sinds het begin. Per naam blijft enkel de beste partij staan.';

  const me = list.querySelector('.me');
  if (me) me.scrollIntoView({ block: 'center' });
}

function showBoard(from, mineTs){
  boardFrom = from;
  boardMine = mineTs || 0;
  show('board');
  renderBoard(mineTs);
}

/* ============================================================
   TEKENEN
   ============================================================ */
function floor(){
  // parket
  for (let y = 0; y < ROWS; y++){
    ctx.fillStyle = (y % 2) ? '#c98f4e' : '#c08544';
    ctx.fillRect(0, y * CELL, W, CELL);
  }
  ctx.strokeStyle = 'rgba(90,50,18,.18)'; ctx.lineWidth = 1;
  for (let y = 1; y < ROWS; y++){
    ctx.beginPath(); ctx.moveTo(0, y * CELL + .5); ctx.lineTo(W, y * CELL + .5); ctx.stroke();
  }
  // heel lichte banen in de andere richting, zodat je kan aflezen op
  // welke rij en kolom je zit zonder dat de vloer een schaakbord wordt
  ctx.strokeStyle = 'rgba(90,50,18,.09)';
  for (let x = 1; x < COLS; x++){
    ctx.beginPath(); ctx.moveTo(x * CELL + .5, 0); ctx.lineTo(x * CELL + .5, H); ctx.stroke();
  }
  // belijning van de zaal
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.strokeStyle = 'rgba(255,240,180,.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(8, H / 2); ctx.lineTo(W - 8, H / 2); ctx.stroke();
}

function drawTable(t){
  const x = t.x * CELL, y = t.y * CELL, w = t.w * CELL, h = t.h * CELL;
  ctx.fillStyle = 'rgba(10,30,10,.35)';
  ctx.fillRect(x + 3, y + 5, w, h);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#1f7a4a'); g.addColorStop(1, '#14582f');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#eaf7ee'; ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.beginPath(); ctx.moveTo(x + 2, y + h / 2); ctx.lineTo(x + w - 2, y + h / 2); ctx.stroke();
  // netje dwars over de tafel
  ctx.fillStyle = 'rgba(240,245,240,.9)';
  ctx.fillRect(x + w / 2 - 1.5, y - 3, 3, h + 6);
}

function drawBall(cx, cy, r, col, ring){
  ctx.beginPath(); ctx.arc(cx + 1.5, cy + 2.5, r, 0, 7);
  ctx.fillStyle = 'rgba(40,20,5,.3)'; ctx.fill();
  const g = ctx.createRadialGradient(cx - r * .35, cy - r * .4, r * .15, cx, cy, r);
  g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  if (ring){
    ctx.beginPath(); ctx.arc(cx, cy, r + ring, 0, 7);
    ctx.strokeStyle = 'rgba(255,190,80,.7)'; ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawBarrier(b){
  const x = b.x * CELL, y = b.y * CELL, w = b.w * CELL, h = b.h * CELL;
  const rechtop = b.h > b.w;
  const d = 6;                                   // hoe dik het bord oogt

  // schaduw op de vloer
  ctx.fillStyle = 'rgba(25,14,4,.35)';
  ctx.beginPath();
  ctx.roundRect(x + (rechtop ? d : 3), y + (rechtop ? 3 : d), rechtop ? w - d : w, rechtop ? h : h - d, 4);
  ctx.fill();

  // het bord zelf
  const bx = x + (rechtop ? d - 2 : 1), by = y + (rechtop ? 1 : d - 2);
  const bw = rechtop ? w - (d - 2) * 2 + 2 : w - 2;
  const bh = rechtop ? h - 2 : h - (d - 2) * 2 + 2;
  const g = rechtop ? ctx.createLinearGradient(bx, 0, bx + bw, 0)
                    : ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, '#2f6fc4'); g.addColorStop(.45, '#1b4b8f'); g.addColorStop(1, '#0f2f5e');
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(8,24,48,.75)'; ctx.lineWidth = 1.5; ctx.stroke();

  // de witte streep van de sponsor
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  if (rechtop) ctx.fillRect(bx + bw / 2 - 1, by + 4, 2, bh - 8);
  else         ctx.fillRect(bx + 4, by + bh / 2 - 1, bw - 8, 2);

  // pootjes aan de uiteinden
  ctx.fillStyle = 'rgba(10,28,56,.9)';
  if (rechtop){
    ctx.fillRect(x + 2, y + 2, w - 4, 3);
    ctx.fillRect(x + 2, y + h - 5, w - 4, 3);
  } else {
    ctx.fillRect(x + 2, y + 2, 3, h - 4);
    ctx.fillRect(x + w - 5, y + 2, 3, h - 4);
  }
}

/* De ballenkar: een mand op wieltjes, met de ballen die de rest van de
   club er al in gekieperd heeft. Twee bij twee cellen, dus veertig bij
   veertig pixels om mee te werken. */
function drawKar(now){
  if (!G.kar) return;
  const x = G.kar.x * CELL, y = G.kar.y * CELL, s = CELL * 2;
  const cx = x + s / 2;

  // een ring die pulseert zolang er iets te lossen valt
  if (G.inBuis > 0){
    const vol = G.inBuis >= BUIS;
    const p = 0.5 + 0.5 * Math.sin(now * 0.005);
    ctx.save();
    ctx.globalAlpha = 0.22 + p * 0.3;
    ctx.beginPath(); ctx.arc(cx, y + s / 2, s * 0.6 + p * 3, 0, 7);
    ctx.strokeStyle = vol ? '#ffd23f' : '#9ef0b4';
    ctx.lineWidth = vol ? 3 : 2;
    ctx.stroke();
    ctx.restore();
  }

  // schaduw
  ctx.fillStyle = 'rgba(25,14,4,.35)';
  ctx.beginPath(); ctx.ellipse(cx, y + s - 4, s * 0.4, 4.5, 0, 0, 7); ctx.fill();

  // de ballen die er al in liggen, net boven de rand
  for (const b of [[-9, 2], [0, -1], [9, 2], [-4, 5], [5, 5]]){
    const bx = cx + b[0], by = y + 9 + b[1];
    const g = ctx.createRadialGradient(bx - 1.6, by - 2, 0.8, bx, by, 5.4);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.75, '#eef2f6'); g.addColorStop(1, '#bcc6d1');
    ctx.beginPath(); ctx.arc(bx, by, 5.2, 0, 7); ctx.fillStyle = g; ctx.fill();
  }

  /* de mand: onderaan wat smaller, zoals elke kar in elke zaal. De vorm
     wordt drie keer gebruikt, dus ze staat apart: vullen, vlechten en de
     flits na het lossen tekenen alle drie hetzelfde pad. */
  const top = y + 8, bot = y + s - 6;
  const mand = () => {
    ctx.beginPath();
    ctx.moveTo(x + 3, top); ctx.lineTo(x + s - 3, top);
    ctx.lineTo(x + s - 7, bot); ctx.lineTo(x + 7, bot);
    ctx.closePath();
  };

  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, 'rgba(58,128,204,.85)');
  g.addColorStop(1, 'rgba(15,47,94,.95)');
  ctx.save();
  mand();
  ctx.fillStyle = g; ctx.fill();

  // het vlechtwerk van de mand, netjes binnen de rand
  ctx.clip();
  ctx.strokeStyle = 'rgba(190,220,245,.35)'; ctx.lineWidth = 1;
  for (let i = -s; i < s * 2; i += 6){
    ctx.beginPath(); ctx.moveTo(x + i, bot); ctx.lineTo(x + i + 14, top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + i, top); ctx.lineTo(x + i + 14, bot); ctx.stroke();
  }
  ctx.restore();

  mand();
  ctx.strokeStyle = '#cfe0ee'; ctx.lineWidth = 2; ctx.stroke();

  // de wieltjes
  ctx.fillStyle = '#12233c';
  for (const wx of [x + 10, x + s - 10]){
    ctx.beginPath(); ctx.arc(wx, bot + 3, 3.2, 0, 7); ctx.fill();
  }

  // net geleegd: even een witte flits
  if (G.karFx > 0){
    ctx.save();
    ctx.globalAlpha = G.karFx * 0.55;
    ctx.fillStyle = '#ffffff';
    mand();
    ctx.fill();
    ctx.restore();
  }
}

function drawDoor(d, now){
  const cx = d.x * CELL + CELL / 2, cy = d.y * CELL + CELL / 2;
  const puls = 0.5 + 0.5 * Math.sin(now * 0.004 + d.x);
  const hoek = { links: 0, boven: Math.PI / 2, rechts: Math.PI, onder: -Math.PI / 2 }[d.zijde] || 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(hoek);          // vanaf hier wijst +x altijd de zaal in

  // het licht dat de zaal in valt
  ctx.save();
  ctx.globalAlpha = 0.3 + puls * 0.18 + G.doorFx * 0.4;
  const g = ctx.createLinearGradient(-4, 0, 22, 0);
  g.addColorStop(0, 'rgba(255,220,150,.85)');
  g.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-4, -9); ctx.lineTo(22, -15); ctx.lineTo(22, 15); ctx.lineTo(-4, 9);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // de deuropening, plat tegen de muur
  ctx.beginPath(); ctx.roundRect(-10, -9, 13, 18, 2.5);
  const dg = ctx.createLinearGradient(-10, 0, 3, 0);
  dg.addColorStop(0, '#5a3a16');
  dg.addColorStop(.45, '#ffd98a');
  dg.addColorStop(1, '#fff3cf');
  ctx.fillStyle = dg; ctx.fill();

  // de stijl errond
  ctx.strokeStyle = '#3d2712'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,200,.45)'; ctx.lineWidth = 1; ctx.stroke();

  // drempel
  ctx.beginPath(); ctx.moveTo(3, -9); ctx.lineTo(3, 9);
  ctx.strokeStyle = 'rgba(70,45,18,.7)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.restore();
}

function drawMate(m){
  let gx = m.x, gy = m.y;
  if (m.moved && !G.waiting){        // glijdt van de vorige cel naar deze
    gx = m.px + (m.x - m.px) * G.frac;
    gy = m.py + (m.y - m.py) * G.frac;
  }
  const cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
  ctx.fillStyle = 'rgba(10,20,40,.35)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 8, 8, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#25406e';
  ctx.beginPath(); ctx.roundRect(cx - 6, cy - 3, 12, 12, 3); ctx.fill();
  ctx.fillStyle = '#f0c9a0';
  ctx.beginPath(); ctx.arc(cx, cy - 6, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#c8242a';
  ctx.beginPath(); ctx.arc(cx + (m.dx > 0 ? 9 : -9), cy + 2, 3.5, 0, 7); ctx.fill();
}

/* De ballenbuis: één doorlopende koker met de balletjes erin,
   een dopje achteraan en de opraapmond vooraan. De koker schuift
   met een deel van een cel mee, zodat het glijdt in plaats van
   van vakje naar vakje te springen. */
function tubePoints(){
  const f = G.waiting ? 0 : G.frac;
  const n = G.snake.length;
  const mid = s => ({ x: s.x * CELL + CELL / 2, y: s.y * CELL + CELL / 2 });
  const pts = new Array(n);

  // de kop schuift alvast naar de volgende cel
  const h = mid(G.snake[0]);
  pts[0] = { x: h.x + G.dir.x * CELL * f, y: h.y + G.dir.y * CELL * f };

  /* Elk balletje schuift naar de plaats van het balletje vóór hem.
     Zo stroomt de hele buis mee in plaats van dat alleen de uiteinden
     bewegen en de rest ter plaatse blijft staan — dat laatste zag je
     als flikkeren. Is de buis net gegroeid, dan blijft de staart staan. */
  for (let i = 1; i < n; i++){
    const a = mid(G.snake[i]);
    if (i === n - 1 && G.grew){ pts[i] = a; continue; }
    // net door een deur: dan liggen twee stukken ver uit elkaar,
    // en mag er niets tussen geschoven of getekend worden
    const sprong = Math.abs(G.snake[i].x - G.snake[i - 1].x) +
                   Math.abs(G.snake[i].y - G.snake[i - 1].y) > 1;
    if (sprong){ pts[i] = a; continue; }
    const b = mid(G.snake[i - 1]);
    pts[i] = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  return pts;
}

function strokeThrough(pts, width, style){
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++){
    const ver = Math.abs(pts[i].x - pts[i - 1].x) > CELL * 1.6 ||
                Math.abs(pts[i].y - pts[i - 1].y) > CELL * 1.6;
    if (ver){ ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i].x, pts[i].y); }
    else ctx.lineTo(pts[i].x, pts[i].y);
  }
  if (pts.length === 1) ctx.lineTo(pts[0].x, pts[0].y);
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.stroke();
}

function drawSnake(){
  const pts = tubePoints();

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap  = 'round';

  // schaduw op de vloer
  ctx.save();
  ctx.translate(2, 4);
  strokeThrough(pts, 19, 'rgba(35,18,4,.32)');
  ctx.restore();

  // de rand van de koker
  strokeThrough(pts, 19, 'rgba(96,112,128,.7)');
  // de binnenkant, net donker genoeg om de balletjes te laten opvallen
  strokeThrough(pts, 16, 'rgba(78,92,106,.35)');

  // de balletjes zitten érin, dus die komen vóór de wand
  for (let i = pts.length - 1; i >= 1; i--){
    const p = pts[i];
    const g = ctx.createRadialGradient(p.x - 2.2, p.y - 2.8, 1, p.x, p.y, 7);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.72, '#f2f5f8'); g.addColorStop(1, '#c2cad3');
    ctx.beginPath(); ctx.arc(p.x, p.y, 6.4, 0, 7);
    ctx.fillStyle = g; ctx.fill();
  }

  /* en daar gaat het doorschijnende plastic overheen. Hoe voller de buis,
     hoe warmer het plastic kleurt: helder, dan amber, dan rood als ze vol
     zit en er niets meer bij kan. */
  const vol = Math.min(1, G.inBuis / BUIS);
  strokeThrough(pts, 16,
    vol >= 1   ? 'rgba(255,150,130,.34)' :
    vol >= 0.7 ? 'rgba(255,214,150,.30)' :
                 'rgba(198,224,244,.26)');

  // glans over de bovenkant van de koker
  ctx.save();
  ctx.translate(-1.5, -4.5);
  ctx.globalAlpha = 0.6;
  strokeThrough(pts, 3.5, '#ffffff');
  ctx.restore();

  // het dopje achteraan
  const tail = pts[pts.length - 1], voor = pts[pts.length - 2] || tail;
  const ta = Math.atan2(tail.y - voor.y, tail.x - voor.x);
  ctx.save();
  ctx.translate(tail.x, tail.y); ctx.rotate(ta);
  ctx.fillStyle = '#1f63b8';
  ctx.beginPath(); ctx.roundRect(-2, -9.5, 8, 19, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(10,30,60,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  // de opraapmond vooraan
  const h = pts[0];
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(Math.atan2(G.dir.y, G.dir.x));

  // een bal die er net ingegaan is, verdwijnt in de bek
  if (G.suck > 0){
    const q = G.suck;
    ctx.save();
    ctx.globalAlpha = q;
    ctx.beginPath(); ctx.arc(9 + q * 9, 0, 2 + q * 4.5, 0, 7);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
  }

  // in een bocht duwt de trechter even in elkaar, en na een slok zet hij uit
  ctx.scale(1 - G.turnFx * 0.22 + G.suck * 0.10,
            1 + G.turnFx * 0.24 + G.suck * 0.10);

  // de trechter: net één cel breed, zodat je ziet in welke rij je zit
  ctx.beginPath();
  ctx.moveTo(-4, -6.5); ctx.lineTo(8, -10); ctx.lineTo(8, 10); ctx.lineTo(-4, 6.5);
  ctx.closePath();
  const fg = ctx.createLinearGradient(-4, -8, 8, 8);
  fg.addColorStop(0, '#ef5a52'); fg.addColorStop(.55, '#c8242a'); fg.addColorStop(1, '#7d1216');
  ctx.fillStyle = fg; ctx.fill();
  ctx.strokeStyle = '#f7e3dd'; ctx.lineWidth = 2; ctx.stroke();

  // de open bek
  ctx.beginPath(); ctx.ellipse(8, 0, 2.4, 8.2, 0, 0, 7);
  ctx.fillStyle = '#33090b'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,210,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  // zolang je onkwetsbaar bent: een rustige ring, geen geknipper
  if (G.invuln > 0){
    ctx.beginPath();
    ctx.arc(h.x, h.y, 13 + Math.sin(G.invuln * 9) * 2.5, 0, 7);
    ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.5, G.invuln * 0.4) + ')';
    ctx.lineWidth = 2.5; ctx.stroke();
  }

  ctx.restore();
}

function render(now){
  ctx.save();
  if (G.shake > 0.2) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);

  floor();
  for (const t of G.tables) drawTable(t);
  for (const b of G.barriers) drawBarrier(b);
  drawKar(now);

  if (G.food){
    const fx = G.food.x * CELL + CELL / 2, fy = G.food.y * CELL + CELL / 2;
    const p = 0.5 + 0.5 * Math.sin(now * 0.005);
    ctx.globalAlpha = 0.25 + p * 0.3;
    ctx.beginPath(); ctx.arc(fx, fy, 9.5 + p * 2.5, 0, 7);
    ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    drawBall(fx, fy, 7, ['#ffffff', '#e2e6ea'], 0);
  }
  if (G.gold){
    const pulse = 1.5 + Math.sin(now * 0.008) * 1.2;
    drawBall(G.gold.x * CELL + CELL / 2, G.gold.y * CELL + CELL / 2, 7,
             ['#ffd08a', '#ef7d18'], pulse);
  }
  if (G.cell){
    // een oude celluloid bal: ivoorgeel, met de naad nog zichtbaar
    const ex = G.cell.x * CELL + CELL / 2, ey = G.cell.y * CELL + CELL / 2;
    const pulse = 1.4 + Math.sin(now * 0.006) * 1.3;
    drawBall(ex, ey, 7.4, ['#fffbe0', '#d9b45a'], pulse);
    ctx.save();
    ctx.strokeStyle = 'rgba(120,80,20,.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(ex, ey, 2.6, 6.8, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }

  for (const d of G.doors) drawDoor(d, now);
  for (const m of G.mates) drawMate(m);
  drawSnake();

  for (const q of G.parts){
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.col;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.font = '10px "Press Start 2P", monospace';
  for (const t of G.texts){
    ctx.globalAlpha = Math.min(1, t.life * 1.6);
    ctx.fillStyle = '#2a1608'; ctx.fillText(t.t, t.x + 2, t.y + 2);
    ctx.fillStyle = t.col;     ctx.fillText(t.t, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  if (G.screen === 'play' && G.waiting){
    const t = (G.lives < 3 || G.balls > 0) ? 'VEEG OM VERDER TE GAAN' : 'VEEG OM TE VERTREKKEN';
    ctx.textAlign = 'center';
    ctx.font = '9px "Press Start 2P", monospace';
    const w = ctx.measureText(t).width + 22;
    ctx.fillStyle = 'rgba(8,24,48,.82)';
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, H - 74, w, 30, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(158,212,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#cfe9ff';
    ctx.fillText(t, W / 2, H - 55);
  }

  ctx.restore();

  /* zolang de trainer fluit hangt er een warme gloed over de zaal —
     stilstaand, niets dat knippert */
  if (G.fluit > 0){
    const a = Math.min(1, G.fluit) * 0.2;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, 'rgba(255,200,80,0)');
    g.addColorStop(1, 'rgba(255,168,40,' + a.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (G.flash > 0.01){
    ctx.fillStyle = 'rgba(255,60,60,' + (G.flash * 0.3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

/* ============================================================
   LOOP
   ============================================================ */
/* De klok komt van performance.now(), niet van de tijdstempel die
   requestAnimationFrame meegeeft: die loopt in sommige omgevingen
   (ingebouwde previews, opnames) niet gelijk met de echte tijd, en
   dan kruipt het spel in slow motion. */
let lastWall = performance.now();
let lastStep = performance.now();

/* zolang de trainer fluit loopt alles een tikje rapper */
function stepNow(){ return G.fluit > 0 ? G.step * 0.85 : G.step; }

function frame(){
  const now = performance.now();
  let dt = (now - lastWall) / 1000;
  lastWall = now;
  if (dt > 0.05) dt = 0.05;          // na een pauze niet ineens doorschieten
  if (dt < 0) dt = 0;

  for (let i = G.parts.length - 1; i >= 0; i--){
    const q = G.parts[i];
    q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    if (q.life <= 0) G.parts.splice(i, 1);
  }
  for (let i = G.texts.length - 1; i >= 0; i--){
    G.texts[i].y -= 30 * dt; G.texts[i].life -= dt;
    if (G.texts[i].life <= 0) G.texts.splice(i, 1);
  }
  G.shake = Math.max(0, G.shake - dt * 60);
  G.flash = Math.max(0, G.flash - dt * 3.5);
  G.suck   = Math.max(0, G.suck   - dt * 5);
  G.turnFx = Math.max(0, G.turnFx - dt * 6);
  G.doorFx = Math.max(0, G.doorFx - dt * 2.5);
  G.karFx  = Math.max(0, G.karFx  - dt * 2.5);
  if (G.invuln > 0) G.invuln = Math.max(0, G.invuln - dt);

  if (G.screen === 'play' && !G.waiting){
    if (G.gold){
      G.gold.life -= dt;
      if (G.gold.life <= 0) G.gold = null;
    }
    if (G.cell){
      G.cell.life -= dt;
      if (G.cell.life <= 0) G.cell = null;
    }

    /* Het fluitje loopt alleen terwijl er gespeeld wordt: sta je op een
       tussenscherm, dan staat de trainer ook stil. */
    if (G.fluit > 0){
      G.fluit = Math.max(0, G.fluit - dt);
      if (G.fluit === 0){ G.fluitIn = 22 + Math.random() * 8; setTag(); }
    } else {
      G.fluitIn -= dt;
      if (G.fluitIn <= 0) startFluit();
    }

    const sp = stepNow();
    let guard = 0;
    while (now - lastStep >= sp && G.screen === 'play' && !G.waiting && guard++ < 4){
      lastStep += sp;
      tick();
    }
    // te ver achterop geraakt (tab stond stil): gewoon opnieuw gelijkzetten
    if (now - lastStep > sp * 4) lastStep = now;
    G.frac = Math.min(1, Math.max(0, (now - lastStep) / sp));
  } else {
    lastStep = now;                  // stilstand telt niet mee
    G.frac = 0;
  }

  render(now);
  requestAnimationFrame(frame);
}

/* ============================================================
   STUREN
   ============================================================ */
function turn(x, y){
  if (G.screen !== 'play') return;

  if (G.waiting){
    if (x === -G.dir.x && y === -G.dir.y) return;   // niet meteen je eigen buis in
    G.dir = { x, y };
    G.waiting = false;
    return;
  }

  const lastDir = G.queue.length ? G.queue[G.queue.length - 1] : G.dir;
  if (x === -lastDir.x && y === -lastDir.y) return;   // niet terugkeren
  if (x === lastDir.x && y === lastDir.y) return;     // zelfde richting
  // voorbij de helft van de stap hoor je visueel al bij de volgende cel
  const wacht = (!G.queue.length && G.frac >= 0.5) ? 1 : 0;
  if (G.queue.length < 2) G.queue.push({ x, y, wacht });
}

addEventListener('keydown', e => {
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowup'    || k === 'w' || k === 'z'){ turn(0, -1); e.preventDefault(); }
  else if (k === 'arrowdown'  || k === 's'){ turn(0, 1);  e.preventDefault(); }
  else if (k === 'arrowleft'  || k === 'a' || k === 'q'){ turn(-1, 0); e.preventDefault(); }
  else if (k === 'arrowright' || k === 'd'){ turn(1, 0);  e.preventDefault(); }
  else if (e.code === 'Space' || e.code === 'Enter'){
    e.preventDefault();
    if (G.screen === 'title') { Snd.init(); startGame(); }
    else if (G.screen === 'table'){ G.waiting = true; show('play'); }
    else if (G.screen === 'over')  startGame();
  }
});

/* vegen: richting zodra je ver genoeg bent, daarna opnieuw meten */
let sw = null;
cv.addEventListener('pointerdown', e => {
  Snd.init();
  const r = cv.getBoundingClientRect();
  sw = { x: e.clientX, y: e.clientY, s: r.width / W };
  try { cv.setPointerCapture(e.pointerId); } catch (_){}
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (!sw) return;
  const dx = (e.clientX - sw.x) / sw.s, dy = (e.clientY - sw.y) / sw.s;
  const TH = 18;
  if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
  if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
  else turn(0, dy > 0 ? 1 : -1);
  sw.x = e.clientX; sw.y = e.clientY;
});
const swEnd = () => { sw = null; };
cv.addEventListener('pointerup', swEnd);
cv.addEventListener('pointercancel', swEnd);
cv.addEventListener('contextmenu', e => e.preventDefault());

/* ============================================================
   KNOPPEN
   ============================================================ */
$('btnStart').onclick  = () => { Snd.init(); startGame(); };
$('btnHow').onclick    = () => show('how');
$('btnBack').onclick   = () => show('title');
$('btnResume').onclick = () => { G.waiting = true; show('play'); };
$('btnRetry').onclick  = () => startGame();
$('btnBoard').onclick     = () => showBoard('title');
$('btnBoardOver').onclick = () => showBoard('over');
$('btnBoardBack').onclick = () => show(boardFrom);
el.tabDag.onclick   = () => { if (!boardVandaag){ boardVandaag = true;  renderBoard(boardMine); } };
el.tabAlles.onclick = () => { if ( boardVandaag){ boardVandaag = false; renderBoard(boardMine); } };

$('btnShare').onclick = async () => {
  const txt = 'Ik raapte ' + G.balls + ' ballen voor ' + G.score +
              ' punten in BALLENRAPER, het officiele videospel van TTC Wielsbeke-Spotit. ' +
              location.href;
  try {
    if (navigator.share) await navigator.share({ text: txt });
    else { await navigator.clipboard.writeText(txt); alert('Gekopieerd! Plak maar in de clubgroep.'); }
  } catch (_){ /* afgebroken */ }
};

el.submitRow.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('btnSubmit');
  if (btn.disabled) return;
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Bezig…';

  const res = await PipsBoard.submit(el.playerName.value, G.score, Math.max(1, G.level));

  btn.disabled = false;
  btn.textContent = label;
  if (!res) return;

  localStorage.setItem('ttcw_name', res.entry.name);
  el.submitRow.classList.add('hidden');
  el.submitDone.classList.remove('hidden');
  el.submitDone.textContent =
    res.offline ? 'Geen verbinding. Bewaard op dit toestel, de club ziet ze nog niet.'
    : res.rank  ? 'Genoteerd als ' + res.entry.name + ' — plaats ' + res.rank + '.'
                : 'Genoteerd als ' + res.entry.name + '.';
  Snd.gold();
  setTimeout(() => showBoard('over', res.entry.ts), 750);
});

el.mute.onclick = () => {
  Snd.on = !Snd.on;
  el.mute.classList.toggle('off', !Snd.on);
};

/* ============================================================
   OPSTART
   ============================================================ */
function resize(){
  const rect = cv.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width  = Math.round(rect.width * dpr);
  cv.height = Math.round(rect.width * dpr * H / W);
  ctx.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
}
addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);

let tickI = 0;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
function news(){
  const t = el.tickText;
  t.textContent = HEADLINES[tickI++ % HEADLINES.length];
  if (REDUCED || !t.animate){ setTimeout(news, 7000); return; }
  const win = t.parentElement.clientWidth, txt = t.scrollWidth;
  if (!win){ setTimeout(news, 1200); return; }
  const a = t.animate(
    [{ transform: 'translateX(' + win + 'px)' }, { transform: 'translateX(' + (-txt) + 'px)' }],
    { duration: (win + txt) / 58 * 1000, easing: 'linear' }
  );
  a.onfinish = news;
}

/* met ?debug in de url ligt de spelstaat open, handig om te testen */
if (location.search.includes('debug'))
  window.__BR = { G, tick, blocked, freeCell, placeKar, dumpBuis, startFluit, karAt, BUIS,
                  maakPlan, dagSleutel, addTable, addBarrier, placeDoors };

// decor achter het titelscherm
G.plan = maakPlan(dagSleutel());
G.teDoen = G.plan.tafels.slice();
G.omhTeDoen = G.plan.omheiningen.slice();
try {
  if (el.dagNaam && window.PipsBoard && PipsBoard.dagNaam){
    el.dagNaam.textContent = PipsBoard.dagNaam() || 'vandaag';
  }
} catch (_){ /* dan blijft er gewoon "vandaag" staan */ }
resetSnake();
addTable(); addTable();
placeKar();
G.food = freeCell();
show('title');
drawHearts(); bumpScore(); bumpBalls();
resize();
news();
requestAnimationFrame(frame);

})();
