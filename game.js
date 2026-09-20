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

const cv  = document.getElementById('game');
const ctx = cv.getContext('2d');

const $ = id => document.getElementById(id);
const el = {
  ballCount: $('ballCount'), scoreDigits: $('scoreDigits'), hearts: $('hearts'),
  levelTag: $('levelTag'), tickText: $('tickText'), mute: $('mute'),
  title: $('screen-title'), how: $('screen-how'), table: $('screen-table'),
  over: $('screen-over'), board: $('screen-board'),
  tableQuip: $('tableQuip'), tableCount: $('tableCount'),
  tableBalls: $('tableBalls'), tableBonus: $('tableBonus'),
  overQuip: $('overQuip'), finalScore: $('finalScore'), bestOver: $('bestOver'),
  boardList: $('boardList'), boardNote: $('boardNote'),
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
  'Nieuwe regel: wie het laatst klaar is, plooit de tafels.'
];

const TABLE_QUIPS = [
  'Er komt een tafel bij. Natuurlijk komt er een tafel bij.',
  'De jeugdtraining begint. Veel plezier.',
  'Nog een tafel. Nog meer poten om tegenaan te rijden.',
  'Iemand heeft een tafel opengeplooid en is dan vertrokken.',
  'De zaal vult zich. Jouw buis ook.',
  'Tafel erbij, ruimte eraf. Zo werkt dat.'
];

const OVER_QUIPS = [
  'Je struikelde over je eigen ballenbuis. Iedereen zag het.',
  'De tafelpoot stond daar al twintig jaar.',
  'De zijlijn is ook een lijn, blijkt.',
  'Sorry tegen je clubgenoot gezegd? Dacht het niet.',
  'De rest zit al in de kantine.',
  'Morgen weer een training, morgen weer ballen.'
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
  dead(){ [392, 330, 262, 196].forEach((f, i) => this.tone('square', f, null, 0.1, 0.42, i * 0.16)); }
};

/* ============================================================
   SPELSTAAT
   ============================================================ */
const G = {
  screen: 'title',
  snake: [], dir: { x: 0, y: -1 }, queue: [],
  balls: 0, score: 0, lives: 3,
  tables: [], mates: [],
  food: null, gold: null,
  step: 150,
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

function freeCell(){
  for (let tries = 0; tries < 400; tries++){
    const x = (Math.random() * COLS) | 0;
    const y = (Math.random() * ROWS) | 0;
    if (blocked(x, y)) continue;
    if (G.food && G.food.x === x && G.food.y === y) continue;
    if (G.gold && G.gold.x === x && G.gold.y === y) continue;
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
      return { x, y };
    }
  }
  return null;
}

/* ---------- een tafel erbij ---------- */
function addTable(){
  if (G.tables.length >= 8) return false;
  for (let tries = 0; tries < 300; tries++){
    const w = 4, h = 2;
    const x = 1 + ((Math.random() * (COLS - w - 2)) | 0);
    const y = 1 + ((Math.random() * (ROWS - h - 2)) | 0);

    // het midden vrijhouden om te kunnen herstarten
    if (x < SAFE.x1 && x + w > SAFE.x0 && y < SAFE.y1 && y + h > SAFE.y0) continue;

    // een cel speling rond andere tafels, en niet bovenop de buis
    let ok = true;
    for (let yy = y - 1; yy <= y + h && ok; yy++){
      for (let xx = x - 1; xx <= x + w && ok; xx++){
        if (blocked(xx, yy, { skipMates: true }) === 'tafel') ok = false;
      }
    }
    if (!ok) continue;
    for (let yy = y; yy < y + h && ok; yy++){
      for (let xx = x; xx < x + w && ok; xx++){
        if (blocked(xx, yy, { skipMates: true })) ok = false;
      }
    }
    if (!ok) continue;

    G.tables.push({ x, y, w, h });
    return true;
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
  G.invuln = 1.6;
  G.waiting = true;        // pas vertrekken als de speler zelf stuurt
}

function startGame(){
  G.balls = 0; G.score = 0; G.lives = 3;
  G.tables = []; G.mates = [];
  G.food = null; G.gold = null;
  G.parts = []; G.texts = [];
  G.step = 150;
  resetSnake();
  addTable();
  G.food = freeCell();
  drawHearts(); bumpScore(); bumpBalls();
  show('play');
}

function spawnFood(){
  G.food = freeCell();
  if (!G.gold && Math.random() < 0.2){
    const g = freeCell();
    if (g){ G.gold = g; G.gold.life = 9; }
  }
}

function eat(gold){
  G.suck = 1;
  if (gold){
    G.score += 50;
    G.gold = null;
    addText('+50', '#ffb43f');
    Snd.gold();
  } else {
    G.balls++;
    G.score += 10;
    G.grow += 1;
    bumpBalls();
    Snd.pick(G.snake.length);
    spawnFood();

    if (G.balls % 8 === 0) newTable();
  }
  bumpScore();
  G.step = Math.max(75, 150 - G.balls * 2);
}

function newTable(){
  if (!addTable()) return;
  syncMates();
  const bonus = 100 * G.tables.length;
  G.score += bonus;
  bumpScore();
  el.tableCount.textContent = G.tables.length;
  el.tableBalls.textContent = G.balls;
  el.tableBonus.textContent = bonus;
  el.tableQuip.textContent  = pick(TABLE_QUIPS);
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
  if (G.queue.length){
    const d = G.queue.shift();
    if (d.x !== -G.dir.x || d.y !== -G.dir.y){
      if (d.x !== G.dir.x || d.y !== G.dir.y) G.turnFx = 1;   // even in elkaar duwen
      G.dir = d;
    }
  }

  const head = G.snake[0];
  const nx = head.x + G.dir.x, ny = head.y + G.dir.y;

  // vlak na een herstart lopen clubgenoten even door je heen
  const hit = blocked(nx, ny, { ignoreTail: G.grow === 0, skipMates: G.invuln > 0 });
  if (hit){ crash(hit); return; }

  G.snake.unshift({ x: nx, y: ny });
  G.grew = G.grow > 0;
  if (G.grow > 0) G.grow--; else G.snake.pop();

  if (G.food && G.food.x === nx && G.food.y === ny) eat(false);
  else if (G.gold && G.gold.x === nx && G.gold.y === ny) eat(true);

  moveMates();
  if (G.invuln <= 0){
    for (const m of G.mates){
      if (m.x === nx && m.y === ny){ crash('clubgenoot'); return; }
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
  if (name === 'play') el.levelTag.textContent = G.tables.length + ' TAFELS IN DE ZAAL';
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
function addText(t, col){
  const h = G.snake[0];
  G.texts.push({ x: h.x * CELL + CELL / 2, y: h.y * CELL - 6, t, col, life: 1 });
}

/* ============================================================
   ERELIJST
   ============================================================ */
let boardFrom = 'title', boardToken = 0;

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
  list.textContent = '';
  list.appendChild(boardRow('leeg', [['', 'Laden…']]));
  el.boardNote.textContent = '';

  const res = await PipsBoard.top();
  if (mine !== boardToken) return;

  list.textContent = '';
  if (!res.rows.length){
    list.appendChild(boardRow('leeg', [['', 'Nog niemand. Wees de eerste.']]));
  } else {
    res.rows.forEach((r, i) => {
      list.appendChild(boardRow(mineTs && r.ts === mineTs ? 'me' : '', [
        ['rk', (i + 1) + '.'],
        ['nm', r.name],
        ['sc', String(r.score).padStart(6, '0')],
        ['lv', r.level + ' tafels']
      ]));
    });
  }

  el.boardNote.textContent =
    res.offline ? 'Geen verbinding met de clubranking. Dit is de lijst op dit toestel.'
    : res.remote ? 'De ranglijst van heel de club. Iedereen raapt mee.'
    : res.rows.length ? 'Deze lijst staat op dit toestel.'
    : 'Speel een partij en zet je naam erbij.';

  const me = list.querySelector('.me');
  if (me) me.scrollIntoView({ block: 'center' });
}

function showBoard(from, mineTs){
  boardFrom = from;
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
    const b = mid(G.snake[i - 1]);
    pts[i] = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  return pts;
}

function strokeThrough(pts, width, style){
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
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

  // en daar gaat het doorschijnende plastic overheen
  strokeThrough(pts, 16, 'rgba(198,224,244,.26)');

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
    const t = G.lives < 3 ? 'VEEG OM VERDER TE GAAN' : 'VEEG OM TE VERTREKKEN';
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
  if (G.invuln > 0) G.invuln = Math.max(0, G.invuln - dt);

  if (G.screen === 'play' && !G.waiting){
    if (G.gold){
      G.gold.life -= dt;
      if (G.gold.life <= 0) G.gold = null;
    }
    let guard = 0;
    while (now - lastStep >= G.step && G.screen === 'play' && !G.waiting && guard++ < 4){
      lastStep += G.step;
      tick();
    }
    // te ver achterop geraakt (tab stond stil): gewoon opnieuw gelijkzetten
    if (now - lastStep > G.step * 4) lastStep = now;
    G.frac = Math.min(1, Math.max(0, (now - lastStep) / G.step));
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
  if (G.queue.length < 2) G.queue.push({ x, y });
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
    else if (G.screen === 'table') show('play');
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
$('btnResume').onclick = () => show('play');
$('btnRetry').onclick  = () => startGame();
$('btnBoard').onclick     = () => showBoard('title');
$('btnBoardOver').onclick = () => showBoard('over');
$('btnBoardBack').onclick = () => show(boardFrom);

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

  const res = await PipsBoard.submit(el.playerName.value, G.score, Math.max(1, G.tables.length));

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
if (location.search.includes('debug')) window.__BR = { G, tick, blocked, freeCell };

// decor achter het titelscherm
resetSnake();
addTable(); addTable();
G.food = freeCell();
show('title');
drawHearts(); bumpScore(); bumpBalls();
resize();
news();
requestAnimationFrame(frame);

})();
