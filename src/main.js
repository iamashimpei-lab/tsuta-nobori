// つたのぼり: 画面の流れ・入力・保存
import { createWorld, step, press, lift, stars, STAGES, DT, BODY } from './game.js';
import { createRenderer } from './render.js';
import { unlockAudio, sfx, startMusic, setTension, setSound, voice, loadVoices } from './audio.js';
import { VOICE_IDS } from './voices.js';
import { createBot } from './autoplay.js';
import { LAST_UPDATE } from './version.js';

const SAVE_KEY = 'tsuta-nobori-save-v1'; // gitleaks:allow (保存場所の名前で、秘密ではない)
const HATS = [
  { id: 'none', name: 'なし', cost: 0 },
  { id: 'leaf', name: 'はっぱ', cost: 15 },
  { id: 'flower', name: 'おはな', cost: 35 },
  { id: 'crown', name: 'おうかん', cost: 80 },
];
const ROPES = [
  { id: 'green', name: 'みどり', cost: 0, col: ['#2f5a24', '#7cb342'] },
  { id: 'red', name: 'あか', cost: 10, col: ['#7a1f2a', '#ff5a6e'] },
  { id: 'blue', name: 'あお', cost: 25, col: ['#183a78', '#5ab8ff'] },
  { id: 'gold', name: 'きん', cost: 60, col: ['#7a5410', '#ffd23f'] },
];

function loadSave() {
  const def = { stars: {}, bank: 0, babies: {}, owned: ['none', 'green'], hat: 'none', rope: 'green', music: true, sfx: true, tutorialDone: false };
  try { return { ...def, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return def; }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 保存できない環境でも遊べる */ } }
let save = loadSave();
setSound(save.music, save.sfx);

const canvas = document.getElementById('game');
const R = createRenderer(canvas);
const $ = (id) => document.getElementById(id);
const screens = ['title', 'map', 'hud', 'result', 'village', 'shop', 'pause'];
function show(...ids) { for (const s of screens) $(s).classList.toggle('hidden', !ids.includes(s)); }

let demoBot = null, autoBot = null, evCursor = 0, lastAlarm = 0, lastHelp = 0, wasTense = false;
const params = new URLSearchParams(location.search);
let world = null, mode = 'title', stageIndex = 0, acc = 0, last = performance.now(), visT = 0, resultShown = false, tutorialStep = 0;

function decorate(w) { w.hat = save.hat === 'none' ? null : save.hat; w.ropeColor = ROPES.find(r => r.id === save.rope)?.col; }

function startStage(i) {
  stageIndex = i;
  demoBot = null;
  world = createWorld(i); decorate(world);
  R.reset(); acc = 0; resultShown = false; evCursor = 0; activePointer = null;
  tutorialStep = i === 0 && !save.tutorialDone ? 1 : 0;
  mode = 'play';
  startMusic('play');
  show('hud');
  $('stagename').textContent = `${STAGES[i].id}  ${STAGES[i].name}`;
  $('stagename').classList.remove('fade'); void $('stagename').offsetWidth; $('stagename').classList.add('fade');
  updateHud(true);
}

// ---- 入力: どこを押しても良い。押した場所へロープ、離すと飛ぶ ----
let activePointer = null;
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio(); loadVoices(VOICE_IDS); startMusic(mode === 'play' ? 'play' : 'home');
  if (mode !== 'play') return;
  // 前の指の「離した」が届かなかった時は、ここで離したことにしてから新しい指を受ける
  if (activePointer !== null && activePointer !== e.pointerId) lift(world);
  activePointer = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* 指がもう離れている時は無視 */ }
  const p = R.toWorld(e.clientX, e.clientY);
  const before = world.rope;
  press(world, p.x, p.y);
  if (world.rope && world.rope !== before) R.hint = { x: p.x, y: p.y, t: world.t, miss: !world.rope.target };
  e.preventDefault();
});
const up = (e) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (mode === 'play') lift(world);
};
// 画面のどこで離しても受け取る (canvas の外の表示の上で離した時も)
window.addEventListener('pointerup', up);
window.addEventListener('pointercancel', up);
window.addEventListener('blur', () => { if (activePointer !== null) { activePointer = null; if (mode === 'play') lift(world); } });
document.addEventListener('gesturestart', (e) => e.preventDefault());
// 画面が隠れたら一時停止
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });

// 一時停止: 指の状態だけ解除し、枝や鳥につかまったままにする (手を離させない)
function pause() { if (mode !== 'play') return; mode = 'pause'; activePointer = null; if (world) world.holding = false; show('hud', 'pause'); }
$('pausebtn').addEventListener('click', () => { unlockAudio(); sfx.tap(); pause(); });
$('resume').addEventListener('click', () => { unlockAudio(); sfx.tap(); mode = 'play'; last = performance.now(); show('hud'); });
$('quit').addEventListener('click', () => { sfx.tap(); openMap(); });
$('retry2').addEventListener('click', () => { sfx.tap(); startStage(stageIndex); });

// ---- 画面 ----
// タイトルとマップの後ろでは、自動のサルが遊んでいる (どんな遊びか、見ればわかる)
function newDemo() {
  const si = Math.floor(Math.random() * 3);
  world = createWorld(si); decorate(world); R.reset();
  demoBot = createBot(Math.floor(Math.random() * 1e6), 0.05);
}
function openTitle() {
  mode = 'title'; show('title'); startMusic('home'); showFooter();
  newDemo();
}
function openMap() {
  mode = 'map'; show('map'); startMusic('home');
  if (!world || !demoBot) newDemo();
  const list = $('stages'); list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const unlocked = i === 0 || (save.stars[STAGES[i - 1].id] || []).some(Boolean);
    const got = save.stars[st.id] || [];
    const b = document.createElement('button');
    b.className = 'stage' + (unlocked ? '' : ' locked');
    b.innerHTML = `<span class="num">${st.id}</span><span class="nm">${unlocked ? st.name : '？？？'}</span>
      <span class="st">${[0, 1, 2].map(k => `<i class="${got[k] ? 'on' : ''}">★</i>`).join('')}</span>
      ${save.babies[st.id] ? '<span class="bb">子ザル</span>' : ''}`;
    b.disabled = !unlocked;
    b.addEventListener('click', () => { unlockAudio(); sfx.tap(); startStage(i); });
    list.appendChild(b);
  });
  $('bank').textContent = save.bank;
}
function openVillage() {
  mode = 'village'; show('village');
  const n = Object.values(save.babies).filter(Boolean).length;
  $('villagecount').textContent = `たすけた子ザル ${n} / ${STAGES.length}`;
}
function openShop() {
  mode = 'shop'; show('shop'); renderShop();
}
function renderShop() {
  $('shopbank').textContent = save.bank;
  const mk = (items, kind) => items.map(it => {
    const owned = save.owned.includes(it.id);
    const on = (kind === 'hat' ? save.hat : save.rope) === it.id;
    const swatch = kind === 'rope' ? `<span class="sw" style="background:linear-gradient(90deg,${it.col[0]},${it.col[1]})"></span>` : `<span class="hat hat-${it.id}"></span>`;
    return `<button class="item ${on ? 'on' : ''}" data-kind="${kind}" data-id="${it.id}">${swatch}<span>${it.name}</span><small>${owned ? (on ? 'つけてる' : 'つける') : `くだもの ${it.cost}`}</small></button>`;
  }).join('');
  $('hats').innerHTML = mk(HATS, 'hat');
  $('ropes').innerHTML = mk(ROPES, 'rope');
  for (const b of document.querySelectorAll('#shop .item')) {
    b.addEventListener('click', () => {
      const kind = b.dataset.kind, id = b.dataset.id;
      const it = (kind === 'hat' ? HATS : ROPES).find(x => x.id === id);
      if (!save.owned.includes(id)) {
        if (save.bank < it.cost) { sfx.whiff(); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); return; }
        save.bank -= it.cost; save.owned.push(id); sfx.baby();
      } else sfx.tap();
      if (kind === 'hat') save.hat = id; else save.rope = id;
      writeSave(); renderShop();
    });
  }
}

for (const [id, fn] of [['play', openMap], ['tovillage', openVillage], ['toshop', openShop], ['mapback', openTitle], ['villageback', openTitle], ['shopback', openTitle], ['mapvillage', openVillage]]) {
  $(id).addEventListener('click', () => { unlockAudio(); loadVoices(VOICE_IDS); startMusic('home'); sfx.tap(); fn(); });
}
$('soundbtn').addEventListener('click', () => {
  unlockAudio(); loadVoices(VOICE_IDS);
  save.music = !save.music; save.sfx = save.music; setSound(save.music, save.sfx); writeSave();
  $('soundbtn').textContent = save.music ? 'おと：あり' : 'おと：なし';
});
$('soundbtn').textContent = save.music ? 'おと：あり' : 'おと：なし';

// ---- 結果 ----
function showResult() {
  resultShown = true;
  mode = 'result'; activePointer = null;
  const w = world, st = STAGES[stageIndex];
  show('hud', 'result');
  const clear = w.state === 'clear';
  $('result').classList.toggle('clear', clear); $('result').classList.toggle('fail', !clear);
  $('rtitle').textContent = clear ? 'てっぺん とうちゃく！' : 'みずに のまれた…';
  const s = stars(w);
  const starEls = $('rstars').children;
  for (let k = 0; k < 3; k++) { starEls[k].className = ''; }
  $('rdesc').innerHTML = clear
    ? `<div class="${s[0] ? 'ok' : ''}">★ てっぺんに ついた</div><div class="${s[1] ? 'ok' : ''}">★ くだもの ぜんぶ (${w.fruitsGot}/${w.fruits.length})</div><div class="${s[2] ? 'ok' : ''}">★ からぶり なし${w.whiffs ? ` (${w.whiffs}かい)` : ''}</div>${w.baby ? '<div class="ok baby">子ザルを たすけた！</div>' : ''}`
    : `<div>たかさ ${w.height}m まで いけた</div><div>くだもの ${w.fruitsGot}こ は もらえるよ</div>`;
  if (clear) {
    s.forEach((on, k) => { if (on) setTimeout(() => { starEls[k].className = 'on'; sfx.star(k); }, 500 + k * 380); });
    const prev = save.stars[st.id] || [false, false, false];
    save.stars[st.id] = prev.map((v, k) => v || s[k]);
    if (w.baby) save.babies[st.id] = true;
  }
  save.bank += w.fruitsGot;
  if (stageIndex === 0) save.tutorialDone = true;
  writeSave();
  $('rnext').classList.toggle('hidden', !clear || stageIndex >= STAGES.length - 1);
}
$('rnext').addEventListener('click', () => { sfx.tap(); startStage(stageIndex + 1); });
$('rretry').addEventListener('click', () => { sfx.tap(); startStage(stageIndex); });
$('rmap').addEventListener('click', () => { sfx.tap(); openMap(); });

// ---- HUD ----
let hudCache = '';
function updateHud(force) {
  const w = world;
  const total = Math.round(-w.goalY / 40);
  const hearts = [0, 1, 2].map(k => `<i class="heart${k < w.hearts ? '' : ' lost'}"></i>`).join('');
  const gap = Math.max(0, Math.round((w.water - (w.m.y + BODY)) / 40));
  const key = `${w.hearts}|${w.fruitsGot}|${w.height}|${gap}|${w.combo}|${w.baby}`;
  if (!force && key === hudCache) return;
  hudCache = key;
  $('hearts').innerHTML = hearts;
  $('fruits').textContent = `${w.fruitsGot} / ${w.fruits.length}`;
  $('height').textContent = `${Math.min(w.height, total)}m / ${total}m`;
  $('watergap').textContent = `みずまで ${gap}m`;
  $('watergap').classList.toggle('danger', gap < 5);
  $('babyicon').classList.toggle('on', w.baby);
}

// 1 面のはじめだけ、操作の手引きを順に出す
function tutorial() {
  const el = $('tutorial');
  if (!tutorialStep) { el.classList.add('hidden'); return; }
  const w = world;
  const msgs = {
    1: 'がめんを <b>おしたまま</b> にすると<br>ゆれが 大きくなるよ',
    2: 'ゆれが いちばん たかい ところで<br><b>ゆびを はなす</b> と とぶ！',
    3: 'とんでいる あいだに<br><b>えだ を タッチ</b> すると ロープ！',
  };
  if (tutorialStep === 1 && w.holding && w.t > 0.5) tutorialStep = 1.5;
  if (tutorialStep === 1.5 && (w.m.mode === 'hang' && Math.abs(w.m.vx) > 380)) tutorialStep = 2;
  if (tutorialStep === 2 && w.m.mode === 'fly') tutorialStep = 3;
  if (tutorialStep === 3 && w.events.some(e => e.type === 'attach') && w.m.anchor && w.m.anchor.id !== 0) { tutorialStep = 0; save.tutorialDone = true; writeSave(); }
  const k = tutorialStep === 1.5 ? 1 : tutorialStep;
  if (!tutorialStep) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = msgs[k];
}

// ---- 出来事 → 音と声 ----
function playVoice(e) {
  const r = Math.random();
  switch (e.type) {
    case 'release': if (r < 0.55) voice('jump'); break;
    case 'attach':
      if (e.kind === 'bird') { voice('tgrab'); setTimeout(() => { if (world && world.m.anchor && world.m.anchor.kind === 'bird') voice('tcarry'); }, 1100); }
      else if (e.combo >= 4 && e.combo % 2 === 0) voice('combo');
      else if (r < 0.45) voice('grab');
      break;
    case 'loop': voice('loop'); break;
    case 'whiff': voice('whiff'); break;
    case 'splash': voice('hurt'); break;
    case 'fail': voice('fail'); break;
    case 'clear': voice('clear'); break;
    case 'bounce': voice('bounce'); break;
    case 'fruit': if (r < 0.35) voice('fruit', 0.8); break;
    case 'baby': voice('saved'); break;
    case 'birdTired': voice('ttired'); break;
    case 'birdDrop': voice('tdrop'); break;
  }
}

function playEvents(evs) {
  for (const e of evs) {
    playVoice(e);
    switch (e.type) {
      case 'fire': sfx.fire(); break;
      case 'attach': sfx.attach(e.combo, e.kind); break;
      case 'release': sfx.release(e.nice); break;
      case 'fruit': sfx.fruit(e.n); break;
      case 'whiff': sfx.whiff(); break;
      case 'splash': sfx.splash(); break;
      case 'bounce': sfx.bounce(); break;
      case 'loop': sfx.loop(); break;
      case 'creak': sfx.creak(e.level); break;
      case 'break': sfx.break(); break;
      case 'baby': sfx.baby(); break;
      case 'birdTired': sfx.birdTired(); break;
      case 'land': sfx.land(); break;
      case 'regrow': sfx.regrow(); break;
      case 'clear': sfx.clear(); break;
      case 'fail': sfx.fail(); break;
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  try { frameBody(now); } catch (err) { reportError(err); }
}

let lastErr = 0;
// ホームの一番下: 最終更新 (取り込めているかの目印) と、もしあれば最後のエラー
function showFooter() {
  let err = '';
  try { err = localStorage.getItem('tsuta-last-error') || ''; } catch { /* 読めなくてもよい */ }
  $('footer').textContent = `last update ${LAST_UPDATE}` + (err ? `　/　エラー: ${err}` : '');
}
function reportError(err) {
  const msg = `${err && err.message || err}`.slice(0, 120);
  try { localStorage.setItem('tsuta-last-error', `${new Date().toISOString().slice(0, 16)} ${msg}`); } catch { /* 保存できなくても続ける */ }
  if (performance.now() - lastErr > 5000) { lastErr = performance.now(); console.error(err); }
  showFooter();
}

function frameBody(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  visT += dt;
  if (mode === 'play' && world) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 12) {
      if (autoBot) autoBot.tick(world);
      step(world);
      if (autoBot) autoBot.after(world);
      acc -= DT; n++;
    }
    // 入力 (押す・離す) で起きた出来事も含め、まだ知らせていない分をまとめて音と演出へ
    if (world.events.length > evCursor) {
      const evs = world.events.slice(evCursor);
      evCursor = world.events.length;
      R.onEvents(world, evs); playEvents(evs);
    }
    if (world.events.length > 400) { const cut = world.events.length - 200; world.events.splice(0, cut); evCursor -= cut; }
    updateHud();
    tutorial();
    const gap = world.water - (world.m.y + BODY);
    const tension = world.state === 'play' ? Math.max(0, Math.min(1, 1 - (gap - 60) / 260)) : 0;
    setTension(tension);
    // 水が近い時の警告音 (曲とは別に鳴らす)
    if (tension > 0.6 && now - lastAlarm > 420) { lastAlarm = now; sfx.alarm(); }
    if (tension > 0.6 && !wasTense) voice('scared');
    wasTense = tension > 0.6;
    // 画面に子ザルが見えている間、ときどき「たすけてー！」
    if (!world.baby && world.state === 'play' && now - lastHelp > 5200) {
      const b = world.anchors.find((a) => a.baby);
      if (b && Math.abs(b.y - R.camY) < R.viewH * 0.5) { lastHelp = now; voice('help', 0.9); }
    }
    if (world.state !== 'play' && !resultShown && world.t - (world.clearT ?? world.t) >= 0) {
      if (!world._endAt) world._endAt = world.t;
      // 終わった後も少し世界を動かして余韻を見せる
      world.t += dt;
      if (world.t - world._endAt > 1.3) showResult();
    }
  } else if (mode === 'result' && world) {
    world.t += dt;
  } else if (world && demoBot && (mode === 'title' || mode === 'map')) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 12) {
      const before = world.events.length;
      demoBot.tick(world); step(world); demoBot.after(world);
      acc -= DT; n++;
      if (world.events.length > before) R.onEvents(world, world.events.slice(before));
    }
    if (world.events.length > 400) world.events.splice(0, world.events.length - 200);
    if (world.state !== 'play') { world.t += dt; if (!world._endAt) world._endAt = world.t; if (world.t - world._endAt > 2) newDemo(); }
    setTension(0);
  }
  if (mode === 'village' || mode === 'shop') {
    const n = Object.values(save.babies).filter(Boolean).length;
    R.drawVillage(n, visT, save.hat === 'none' ? null : save.hat);
  } else if (world) {
    R.draw(world, dt, mode === 'play' || mode === 'pause' || mode === 'result' ? world.t : visT);
  }
}

function onResize() { R.resize(); $('rotate').classList.toggle('hidden', !(window.innerHeight > window.innerWidth * 1.9)); }
window.addEventListener('resize', onResize);
onResize();
openTitle();
// ?auto=面番号 で自動プレイ (確認用)
if (params.has('auto')) { startStage(Number(params.get('auto')) || 0); autoBot = createBot(Number(params.get('seed') || 7), 0.06); }
requestAnimationFrame(frame);

// オフライン用 (2 回目からはネットなしでも開ける)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// 自動テスト用の窓口
window.__tsuta = { get world() { return world; }, startStage, openMap, openVillage, openShop, get mode() { return mode; } };
