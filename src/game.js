// つたのぼり: 物理・面づくり・ルール (描画と音を持たない。node の自動プレイでも同じものを使う)
// 座標は y が下向き正。画面に見える横幅は WORLD_W で固定し、画面の大きさに合わせて拡大縮小する。
// 森の横幅は FOREST_W (画面 2 枚分)。両側に壁はなく、カメラが左右にもサルを追う。

export const G = 2200;
export const DT = 1 / 120;
export const WORLD_W = 1200; // 画面に見える横幅。iPad 横画面 (4:3) で縦に約 900 見える
export const FOREST_W = 2400; // 枝のある森の横幅。この外には枝がない
export const TRUNK_GAP = 600; // 奥に立つ木の幹の間隔 (見た目だけ。当たらない)
export const trunkX = x => clamp(Math.round((x - TRUNK_GAP / 2) / TRUNK_GAP), 0, FOREST_W / TRUNK_GAP - 1) * TRUNK_GAP + TRUNK_GAP / 2;
export const ROPE_RANGE = 360;
export const ROPE_SPEED = 4200;
export const BODY = 52; // 手 (ロープの先) から体の中心までの距離
export const HEARTS = 3;
export const AIR_DRAG = 1.0; // 空中で横の勢いが弱まる速さ (1 秒で約 37% に)

// ---- 面の設計 (ワールド 1) ----
// gimmick ごとに 1 つずつ新しい仕掛けを安全な場所で見せ、最後の面で組み合わせる
export const STAGES = [
  { id: '1-1', name: 'はじめての つる', height: 2400, gap: [150, 200], water: 26, fruits: 8, gimmick: 'basic', seed: 11 },
  { id: '1-2', name: 'とりさん はこんで', height: 3000, gap: [160, 210], water: 32, fruits: 9, gimmick: 'bird', seed: 23 },
  { id: '1-3', name: 'ポキッと えだ', height: 3200, gap: [165, 215], water: 38, fruits: 10, gimmick: 'thin', seed: 37 },
  { id: '1-4', name: 'ながい つる', height: 3400, gap: [170, 220], water: 38, fruits: 10, gimmick: 'vine', seed: 41 },
  { id: '1-5', name: 'ジャングルの てっぺん', height: 4200, gap: [160, 210], water: 43, fruits: 12, gimmick: 'mix', seed: 59 },
  // ワールド 2 どうぶつの森 (2026-10-16): 動物の仕掛けを 1 面に 1 つずつ
  { id: '2-1', name: 'キリンの くび', height: 3000, gap: [160, 210], water: 27, fruits: 9, gimmick: 'giraffe', seed: 5083 },
  { id: '2-2', name: 'ゾウの はな', height: 3200, gap: [160, 210], water: 34, fruits: 10, gimmick: 'trunk', seed: 83 },
  { id: '2-3', name: 'のんびり ナマケモノ', height: 3300, gap: [165, 215], water: 30, fruits: 10, gimmick: 'sloth', seed: 7097 },
  { id: '2-4', name: 'ブンブン ハチ', height: 3400, gap: [165, 215], water: 36, fruits: 10, gimmick: 'bees', seed: 103 },
  { id: '2-5', name: 'どうぶつの もりの てっぺん', height: 4400, gap: [160, 210], water: 39, fruits: 12, gimmick: 'mix2', seed: 9157 },
];
export const worldOf = st => Number(st.id[0]);

// キリン: 頭につかまると首が上がる (GIR_UP/秒、最大 GIR_H)。離すとゆっくり下がる
export const GIR_H = 520, GIR_UP = 300, GIR_DOWN = 150;
// ゾウ: 鼻の先につかまると、TRUNK_WIND 秒ためてから上へ放り上げる
export const TRUNK_WIND = 0.45, TRUNK_VY = -1750;
// ハチ: 群れに当たるとロープが外れる (ハートは減らない)。当たり判定の半径
export const BEE_R = 62;

export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
const hyp = Math.hypot;

// 鳥: 決まった高さの道を、すみか (home) の左右 BIRD_SPAN を往復する。運んでいる間だけ別の動き
// 往復する範囲は森の中 (運ぶ時の範囲 70〜FOREST_W-70 と同じ) に収める
const BIRD_SPAN = 1300;
function birdFreePos(b, t) {
  const x0 = clamp(b.home - BIRD_SPAN / 2, 70, FOREST_W - 70 - BIRD_SPAN), span = BIRD_SPAN;
  const u = ((t * b.speed + b.phase) % (2 * span) + 2 * span) % (2 * span);
  const forward = u < span;
  const x = x0 + (forward ? u : 2 * span - u);
  return { x, y: b.lane + Math.sin(t * 2.2 + b.phase) * 14, vx: forward ? b.speed : -b.speed, vy: 0, dir: forward ? 1 : -1 };
}

export function anchorPos(w, a, t = w.t) {
  if (a.kind === 'bird') {
    if (a.mode === 'carry' || a.mode === 'leave') {
      const d = t - a.modeT;
      const x = clamp(a.cx + a.cvx * d, 70, FOREST_W - 70);
      const vx = x === 70 || x === FOREST_W - 70 ? 0 : a.cvx;
      return { x, y: a.cy + a.cvy * d, vx, vy: a.cvy, dir: Math.sign(a.cvx) || 1 };
    }
    return birdFreePos(a, t);
  }
  if (a.kind === 'giraffe') {
    const h = clamp(a.h + a.hv * (t - w.t), 0, GIR_H);
    const moving = h > 0 && h < GIR_H;
    return { x: a.x, y: a.baseY - h, vx: 0, vy: moving ? -a.hv : 0 };
  }
  if (a.kind === 'sloth') {
    const u = t * a.sp + a.phase;
    return { x: a.x0 + Math.sin(u) * a.span, y: a.y, vx: Math.cos(u) * a.span * a.sp, vy: 0, dir: Math.cos(u) >= 0 ? 1 : -1 };
  }
  return { x: a.x, y: a.y, vx: 0, vy: 0 };
}

export function beePos(b, t) {
  return { x: b.x0 + Math.sin(t * b.sp + b.phase) * b.span, y: b.y + Math.sin(t * 2.1 + b.phase) * 18, dir: Math.cos(t * b.sp + b.phase) >= 0 ? 1 : -1 };
}

export function grabbable(w, a, t = w.t) {
  if (a.kind === 'thin') return !a.broken;
  if (a.kind === 'bird') return a.mode === 'free' && t >= (a.restUntil || 0);
  if (a.kind === 'trunk') return t >= (a.restUntil || 0);
  return true;
}

// ロープの届く点 (つるは垂れた先、他は本体)
export function grabPoint(w, a, t = w.t) {
  const p = anchorPos(w, a, t);
  if (a.kind === 'vine') return { x: p.x + Math.sin(t * 1.3 + a.x) * 10, y: p.y + a.len };
  return p;
}

export function buildLevel(stageIndex) {
  const st = STAGES[stageIndex];
  const R = rng(st.seed);
  const rand = (a, b) => a + (b - a) * R();
  const anchors = [], fruits = [], leaves = [], bees = [];
  const add = (a) => { a.id = anchors.length; anchors.push(a); return a; };
  const goalY = -st.height;

  let x = FOREST_W / 2, y = -180;
  add({ kind: 'branch', x, y, chain: true, size: 1.25 });
  let dir = R() < 0.5 ? 1 : -1;
  const chain = [anchors[0]];
  let segment = 0;
  let pendingBird = 0, pendingVine = 0, pendingLeaf = 0;
  const g = st.gimmick;
  while (y > goalY + 320) {
    segment++;
    const frac = -y / st.height;
    let gap = rand(st.gap[0], st.gap[1]);
    let kind = 'branch';
    // 仕掛けの割り当て (最初の 3 本は必ず普通の枝 = 安全な練習場所)
    let special = null;
    if (segment > 3) {
      if ((g === 'bird' || g === 'mix') && segment % (g === 'bird' ? 5 : 7) === 0) special = 'bird';
      else if ((g === 'vine' || g === 'mix') && segment % (g === 'vine' ? 4 : 6) === 2) special = 'vine';
      else if ((g === 'thin' || g === 'mix') && R() < (g === 'thin' ? 0.38 : 0.2)) kind = 'thin';
      else if (g === 'mix' && segment % 9 === 5) special = 'leaf';
      else if ((g === 'giraffe' || g === 'mix2') && segment % (g === 'giraffe' ? 5 : 9) === 0) special = 'giraffe';
      else if ((g === 'trunk' || g === 'mix2') && segment % (g === 'trunk' ? 5 : 9) === 3) special = 'trunk';
      else if ((g === 'sloth' || g === 'mix2') && segment % (g === 'sloth' ? 4 : 9) === (g === 'sloth' ? 2 : 6)) special = 'sloth';
      else if (g === 'mix2' && R() < 0.12) kind = 'thin';
    }
    // ハチの群れ: この 1 歩の途中を左右に行き来する (普通の 1 歩に重ねる)
    const bee = segment > 3 && !special && ((g === 'bees' && segment % 3 === 1) || (g === 'mix2' && segment % 7 === 4));
    if (special === 'bird') {
      // 大きな切れ目: 鳥でしか越えられない。下の枝の少し上を鳥が往復する
      const lane = y - 150;
      add({ kind: 'bird', lane, home: x, speed: 210 + R() * 50, phase: R() * 900, mode: 'free', chain: true });
      gap = 560 + R() * 80;
      pendingBird++;
    } else if (special === 'vine') {
      // 大きな切れ目: 上から長いつるが垂れている
      const top = y - gap - 360;
      const vx = clamp(x + dir * rand(90, 160), 130, FOREST_W - 130);
      add({ kind: 'vine', x: vx, y: top, len: 300, chain: true });
      gap = gap + 330;
      pendingVine++;
    } else if (special === 'leaf') {
      // 切れ目の下に大きな葉 (トランポリン)
      leaves.push({ x: clamp(x + dir * 120, 140, FOREST_W - 140), y: y + 120, w: 170 });
      gap += 120;
      pendingLeaf++;
    } else if (special === 'giraffe') {
      // 大きな切れ目: キリンの頭につかまって持ち上げてもらう。次の枝は首が上がりきった所の近く
      const hx = clamp(x + dir * rand(120, 160), 160, FOREST_W - 160);
      const baseY = y - 30;
      add({ kind: 'giraffe', x: hx, baseY, h: 0, hv: 0, chain: true });
      x = hx - dir * 120; y = baseY - GIR_H; gap = rand(40, 80);
    } else if (special === 'trunk') {
      // 大きな切れ目: ゾウの鼻につかまると上へ放り上げてもらう
      const tx = clamp(x + dir * rand(140, 190), 180, FOREST_W - 180);
      const ty = y - rand(120, 160);
      add({ kind: 'trunk', x: tx, y: ty, dir, chain: true });
      x = tx; y = ty - 560; gap = rand(0, 40);
    } else if (special === 'sloth') {
      // 横の切れ目: ナマケモノがゆっくり左右に動く。端まで運んでもらってから飛ぶ
      const span = 210;
      const x0 = clamp(x + dir * rand(160, 220), 140 + span, FOREST_W - 140 - span);
      const sy = y - rand(150, 190);
      add({ kind: 'sloth', x0, y: sy, span, sp: 0.45, phase: R() * 6, chain: true });
      x = clamp(x0 + dir * span, 140, FOREST_W - 140); y = sy; gap = rand(140, 180);
    }
    let dx = rand(130, 280) * dir;
    if (x + dx < 140 || x + dx > FOREST_W - 140) { dir = -dir; dx = -dx; }
    const nx = clamp(x + dx, 140, FOREST_W - 140);
    const ny = y - gap;
    let fy = ny;
    if (!special) {
      // 普通の 1 歩は 320 を超えないように縦を詰める
      const ddx = nx - x;
      if (hyp(ddx, gap) > 320) fy = y - Math.sqrt(Math.max(100 * 100, 320 * 320 - ddx * ddx));
    }
    const a = add({ kind, x: nx, y: fy, chain: true, size: 0.85 + R() * 0.4 });
    chain.push(a);
    if (bee) bees.push({ x0: (x + nx) / 2, y: (y + fy) / 2 + 30, span: 260, sp: 0.55, phase: R() * 6 });
    // 同じ向きに続けて進むこともある (森の横の広さを使う)
    if (R() < 0.5) dir = -dir;
    x = nx; y = fy;
  }
  // 道以外の枝 (寄り道・くだもの用)。近すぎる所には置かない
  // 道の左右 450 以内に置く (飛びすぎても近くに何かつかめる枝があるように)
  const extras = Math.round(st.height / 130);
  for (let k = 0, tries = 0; k < extras && tries < 1600; tries++) {
    const ey = rand(goalY + 300, -380);
    const near = chain.reduce((b, a) => (a.kind !== 'bird' && Math.abs(a.y - ey) < Math.abs(b.y - ey) ? a : b), chain[0]);
    const ex = clamp(near.x + rand(-450, 450), 130, FOREST_W - 130);
    if (anchors.some(a => STATIC.has(a.kind) && hyp((a.x ?? 0) - ex, (a.kind === 'vine' ? a.y + a.len : a.y) - ey) < 150)) continue;
    if (anchors.some(a => a.kind === 'bird' && Math.abs(a.lane - ey) < 120)) continue;
    // 動物の仕掛けの切れ目には寄り道の枝を置かない (仕掛けを使わずに越えられてしまうので)
    if (anchors.some(a => a.kind === 'giraffe' && Math.abs(a.x - ex) < 520 && ey < a.baseY + 40 && ey > a.baseY - GIR_H - 40)) continue;
    if (anchors.some(a => a.kind === 'trunk' && Math.abs(a.x - ex) < 520 && ey < a.y + 40 && ey > a.y - 520)) continue;
    if (anchors.some(a => a.kind === 'sloth' && Math.abs(a.y - ey) < 130 && Math.abs(a.x0 - ex) < a.span + 200)) continue;
    add({ kind: 'branch', x: ex, y: ey, chain: false, size: 0.8 + R() * 0.3 });
    k++;
  }
  // くだもの: 道の枝と枝の間、飛んだ時の山の頂上あたり
  const chainBranches = chain.filter(a => a.kind !== 'bird');
  const step = Math.max(1, Math.floor((chainBranches.length - 1) / st.fruits));
  for (let i = 1; i < chainBranches.length && fruits.length < st.fruits; i += step) {
    const a = chainBranches[i - 1], b = chainBranches[i];
    if (b.kind === 'vine' || a.kind === 'vine') continue;
    fruits.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 40, kind: fruits.length % 3, got: false });
  }
  // 子ザル: 半分より少し上の寄り道の枝に座っている
  const side = anchors.filter(a => !a.chain && a.kind === 'branch' && -a.y > st.height * 0.4 && -a.y < st.height * 0.8);
  const babyAnchor = side.length ? side[Math.floor(side.length / 2)] : chainBranches[Math.floor(chainBranches.length * 0.6)];
  babyAnchor.baby = true;
  // 最後の道の枝が てっぺん (大きな枝)。つかまればクリア
  const top = chainBranches[chainBranches.length - 1];
  top.goal = true; top.size = 1.6; top.baby = top.baby || false;
  return { stage: st, anchors, fruits, leaves, bees, goalY: top.y - 60, chain };
}
const STATIC = new Set(['branch', 'thin', 'vine', 'trunk']);

export function createWorld(stageIndex) {
  const lv = buildLevel(stageIndex);
  const a0 = lv.anchors[0];
  const w = {
    stageIndex, stage: lv.stage, anchors: lv.anchors, fruits: lv.fruits, leaves: lv.leaves, bees: lv.bees, goalY: lv.goalY,
    t: 0, steps: 0,
    m: { x: a0.x + 70, y: a0.y + 195, vx: 0, vy: 0, mode: 'hang', anchor: a0, L: 210, Lmin: 150, attachT: 0, rot: 0 },
    rope: null, holding: false, autoRelease: null,
    water: a0.y + 900, waterPause: 0, ground: a0.y + 390,
    hearts: HEARTS, combo: 0, maxCombo: 0, lastRelease: -9, whiffs: 0, fruitsGot: 0, baby: false,
    freeze: 0, state: 'play', events: [], height: 0, clearT: null, chain: lv.chain,
  };
  w.started = false; // 最初に指を離すまで水は動かない
  return w;
}

function ev(w, type, extra = {}) { w.events.push({ type, t: w.t, ...extra }); }

// ---- 入力 ----
// 押す: ロープを狙った方向へ。押している間はぶら下がる。離す: 手を離して飛ぶ
export function pickTarget(w, tx, ty) {
  const m = w.m;
  const dx0 = tx - m.x, dy0 = ty - m.y, d0 = hyp(dx0, dy0) || 1;
  let best = null, bestScore = 1e9;
  for (const a of w.anchors) {
    if (!grabbable(w, a)) continue;
    if (m.mode === 'hang' && m.anchor === a) continue;
    const g = grabPoint(w, a);
    const dx = g.x - m.x, dy = g.y - m.y, d = hyp(dx, dy);
    if (d > ROPE_RANGE || d < 30) continue;
    // 指の近く (110 以内) か、指の方向から 24 度以内なら候補
    const near = hyp(g.x - tx, g.y - ty);
    const cos = (dx * dx0 + dy * dy0) / (d * d0);
    const ang = Math.acos(clamp(cos, -1, 1));
    if (near > 110 && ang > 0.42) continue;
    const score = Math.min(near, ang * 260);
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export function press(w, tx, ty) {
  w.holding = true;
  if (w.state !== 'play') return;
  if (w.m.mode === 'hang' || w.rope) return;
  if (!w.started && w.m.mode === 'stand') { w.started = true; w.waterPause = 2.0; }
  const target = pickTarget(w, tx, ty);
  const m = w.m;
  if (target) {
    w.rope = { phase: 'out', x: m.x, y: m.y, target };
  } else {
    const d = hyp(tx - m.x, ty - m.y) || 1;
    w.rope = { phase: 'out', x: m.x, y: m.y, target: null, px: m.x + (tx - m.x) / d * ROPE_RANGE, py: m.y + (ty - m.y) / d * ROPE_RANGE };
  }
  ev(w, 'fire', { tx, ty, miss: !target });
}

export function lift(w) {
  w.holding = false;
  if (w.state !== 'play') return;
  if (!w.started) { w.started = true; w.waterPause = 2.0; }
  if (w.m.mode === 'hang') release(w);
}

function release(w) {
  const m = w.m;
  const a = m.anchor;
  if (a && a.kind === 'bird') birdDrop(w, a);
  const nice = Math.abs(m.rot) < 0.1 ? false : m.vy < -200 && Math.abs(Math.atan2(-m.vy, Math.abs(m.vx))) > 0.6;
  m.mode = 'fly'; m.anchor = null;
  w.lastRelease = w.t; w.autoRelease = null;
  ev(w, 'release', { nice, x: m.x, y: m.y, speed: hyp(m.vx, m.vy) });
}

function birdDrop(w, a) {
  const p = anchorPos(w, a);
  a.mode = 'leave'; a.modeT = w.t; a.cx = p.x; a.cy = p.y; a.cvx = p.vx * 1.6 || 300; a.cvy = -320;
  a.returnAt = w.t + 2.5;
}

function attach(w, a) {
  const m = w.m;
  const p = anchorPos(w, a);
  m.mode = 'hang'; m.anchor = a; m.attachT = w.t; m.rot = 0;
  m.prevPhi = Math.atan2(m.x - p.x, m.y - p.y);
  m.L = Math.max(70, hyp(m.x - p.x, m.y - p.y));
  if (a.kind === 'vine') m.L = Math.min(m.L, a.len + 50);
  m.Lmin = Math.max(80, m.L * 0.78);
  w.rope = null;
  const chained = w.lastRelease > 0 && w.t - w.lastRelease < 1.3;
  w.combo = chained ? w.combo + 1 : 1;
  w.maxCombo = Math.max(w.maxCombo, w.combo);
  if (w.combo >= 2) {
    const k = Math.min(1.1, 1 + 0.025 * w.combo);
    m.vx *= k; m.vy *= k;
  }
  if (a.kind === 'bird') {
    a.mode = 'carry'; a.modeT = w.t; a.cx = p.x; a.cy = p.y; a.cvx = p.vx * 0.8; a.cvy = -250;
    m.L = Math.min(m.L, 170); m.Lmin = m.L;
  }
  if (a.kind === 'thin') { a.holdStart = w.t; }
  if (a.kind === 'giraffe') { m.L = Math.min(m.L, 170); m.Lmin = Math.min(m.Lmin, m.L); }
  if (a.kind === 'trunk') { a.throwAt = w.t + TRUNK_WIND; m.L = Math.min(m.L, 140); m.Lmin = m.L; ev(w, 'trunkWind', { x: p.x, y: p.y }); }
  if (a.goal) { w.state = 'clear'; w.clearT = w.t; ev(w, 'attach', { combo: w.combo, x: p.x, y: p.y, kind: a.kind }); ev(w, 'clear'); return; }
  if (a.baby && !w.baby) { w.baby = true; ev(w, 'baby', { x: p.x, y: p.y }); }
  w.freeze = 5;
  if (!w.holding) w.autoRelease = w.t + 0.1;
  ev(w, 'attach', { combo: w.combo, x: p.x, y: p.y, kind: a.kind });
}

function splash(w) {
  const m = w.m;
  w.hearts--;
  w.combo = 0;
  ev(w, 'splash', { x: m.x, y: w.water, hearts: w.hearts });
  if (w.hearts <= 0) {
    w.state = 'fail'; ev(w, 'fail');
    return;
  }
  // 水しぶきで上へ跳ね上げ、水は少し下がって一休み
  if (m.mode === 'hang') release(w);
  w.rope = null;
  m.y = w.water - 60; m.vx *= 0.3; m.vy = -1650;
  // 水しぶきで、少し上の道の枝の真下あたりへ跳ね上げる (横へ飛びすぎても道に戻れる)
  let best = null;
  for (const a of w.chain) { if (a.kind === 'bird') continue; const d = Math.abs(a.y - (m.y - 400)); if (!best || d < best.d) best = { a, d }; }
  if (best) {
    const tx = best.a.x;
    if (Math.abs(tx - m.x) > 1100) m.x = tx - Math.sign(tx - m.x) * 1100;
    m.vx = (tx - m.x) / 0.75; // 0.75 秒 = 跳ね上がって頂点に着くまで
  }
  w.water += 320; w.waterPause = 1.6;
  w.invuln = w.t + 1.2;
}

function phiOf(m, p) { return Math.atan2(m.x - p.x, m.y - p.y); }

// 1 step 進める
export function step(w) {
  w.t += DT; w.steps++;
  if (w.state !== 'play') return;
  if (w.freeze > 0) { w.freeze--; return; }
  const m = w.m;

  // 鳥の状態
  for (const a of w.anchors) {
    if (a.kind !== 'bird') continue;
    if (a.mode === 'carry') {
      const d = w.t - a.modeT;
      if (d > 1.6 && !a.tired) { a.tired = true; ev(w, 'birdTired', { x: a.cx, y: a.cy }); }
      if (d > 2.5 && m.mode === 'hang' && m.anchor === a) { release(w); ev(w, 'birdDrop'); }
    }
    if (a.mode === 'leave' && w.t > a.returnAt) { a.mode = 'free'; a.tired = false; a.restUntil = w.t + 1.0; }
  }
  // 細い枝: ミシッ → ひび → 折れる。しばらくすると生え直す
  for (const a of w.anchors) {
    if (a.kind !== 'thin') continue;
    if (a.broken) { if (w.t > a.regrowAt) { a.broken = false; a.crack = 0; ev(w, 'regrow', { x: a.x, y: a.y }); } continue; }
    if (m.mode === 'hang' && m.anchor === a) {
      const d = w.t - a.holdStart;
      const c = d > 1.5 ? 3 : d > 1.0 ? 2 : d > 0.45 ? 1 : 0;
      if (c > (a.crack || 0)) { a.crack = c; ev(w, c === 3 ? 'break' : 'creak', { x: a.x, y: a.y, level: c }); }
      if (c === 3) { a.broken = true; a.regrowAt = w.t + 5; release(w); }
    } else if (a.crack && a.crack < 3) {
      a.crack = 0;
    }
  }

  // キリン: つかまっている間は首が上がり、離すとゆっくり下がる
  for (const a of w.anchors) {
    if (a.kind !== 'giraffe') continue;
    const on = m.mode === 'hang' && m.anchor === a;
    a.hv = on ? (a.h < GIR_H ? GIR_UP : 0) : (a.h > 0 ? -GIR_DOWN : 0);
    const was = a.h;
    a.h = clamp(a.h + a.hv * DT, 0, GIR_H);
    if (on && was < GIR_H && a.h >= GIR_H) ev(w, 'giraffeTop', { x: a.x, y: a.baseY - GIR_H });
  }
  // ゾウ: ためが終わったら上へ放り上げる
  if (m.mode === 'hang' && m.anchor && m.anchor.kind === 'trunk' && w.t >= m.anchor.throwAt) {
    const a = m.anchor;
    a.restUntil = w.t + 1.2;
    release(w);
    m.x = a.x; m.y = a.y + 40; m.vx = a.dir * 260; m.vy = TRUNK_VY;
    ev(w, 'trunkThrow', { x: a.x, y: a.y });
  }
  // ハチ: 飛んでいる時に群れに当たると、少し弾かれてロープも戻る (ハートは減らない)。
  // ぶら下がって揺れている時は当たらない (揺れるたびに落とされると理不尽なので)
  if (m.mode === 'fly' && !(w.beeSafe > w.t)) {
    for (const b of w.bees) {
      const p = beePos(b, w.t);
      if (hyp(p.x - m.x, p.y - (m.y + BODY * 0.5)) < BEE_R) {
        w.beeSafe = w.t + 1.5; w.combo = 0;
        if (w.rope && w.rope.phase === 'out') w.rope.phase = 'back';
        m.vx = Math.sign(m.x - p.x || 1) * 320; m.vy = Math.max(m.vy, 150);
        ev(w, 'sting', { x: m.x, y: m.y });
        break;
      }
    }
  }

  if (w.autoRelease && w.t >= w.autoRelease && m.mode === 'hang') release(w);

  // 重力と、押している間の漕ぎ
  if (m.mode !== 'stand') m.vy += G * DT;
  if (m.mode === 'hang') {
    const p = anchorPos(w, m.anchor);
    const f = phiOf(m, p);
    if (w.holding && Math.abs(f) < 0.65 && m.anchor.kind !== 'bird') {
      const dx = m.x - p.x, dy = m.y - p.y, r = hyp(dx, dy) || 1;
      const tvx = m.vx - p.vx, tvy = m.vy - p.vy;
      const sgn = Math.sign(dy * tvx - dx * tvy) || 1;
      m.vx += sgn * (dy / r) * 1500 * DT;
      m.vy += sgn * (-dx / r) * 1500 * DT;
    }
  }
  // 空中では横の勢いが少しずつ弱まる (壁がない代わりに、横へ飛んでいきすぎない)。水しぶきの直後は弱めない
  if (m.mode === 'fly' && !(w.invuln > w.t)) m.vx *= Math.exp(-AIR_DRAG * DT);
  m.x += m.vx * DT; m.y += m.vy * DT;

  if (m.mode === 'hang') {
    const p = anchorPos(w, m.anchor);
    if (w.holding && m.L > m.Lmin) {
      const nl = Math.max(m.Lmin, m.L - 60 * DT);
      m.vx *= m.L / nl; m.vy *= m.L / nl; m.L = nl;
    }
    const dx = m.x - p.x, dy = m.y - p.y, r = hyp(dx, dy);
    if (r > m.L) {
      const nx = dx / r, ny = dy / r;
      m.x = p.x + nx * m.L; m.y = p.y + ny * m.L;
      const wr = (m.vx - p.vx) * nx + (m.vy - p.vy) * ny;
      if (wr > 0) { m.vx -= wr * nx; m.vy -= wr * ny; }
    }
    const f = phiOf(m, p);
    let df = f - m.prevPhi;
    if (df > Math.PI) df -= 2 * Math.PI;
    if (df < -Math.PI) df += 2 * Math.PI;
    m.rot += df; m.prevPhi = f;
    if (Math.abs(m.rot) > 2 * Math.PI && !m.looped) { m.looped = true; ev(w, 'loop', { x: m.x, y: m.y }); }
  } else m.looped = false;

  // スタートの地面 (水がかぶるまでは、落ちてもここからやり直せる)
  if (m.mode === 'stand') {
    m.vx = 0; m.vy = 0; m.y = w.ground - BODY - 34;
    // 端に降りたら、枝の届く真ん中まで歩いて戻る
    const cx = w.anchors[0].x;
    if (Math.abs(m.x - cx) > 90) { m.x += Math.sign(cx - m.x) * 220 * DT; m.walking = true; } else m.walking = false;
  }
  else if (m.mode === 'fly' && w.ground < w.water && m.vy > 0 && m.y + BODY + 34 > w.ground) {
    m.mode = 'stand'; m.vx = 0; m.vy = 0; m.y = w.ground - BODY - 34; w.combo = 0;
    ev(w, 'land', { x: m.x, y: w.ground });
  }
  if (m.mode === 'stand' && w.ground >= w.water) { m.mode = 'fly'; }
  // 速すぎる落下は抑える (子どもが追いつける速さ)
  if (m.vy > 1500) m.vy = 1500;

  // 大きな葉 (上から落ちてきた時だけ跳ねる)
  if (m.mode === 'fly' && m.vy > 0) {
    const by = m.y + BODY + 30;
    for (const l of w.leaves) {
      if (Math.abs(m.x - l.x) < l.w / 2 + 10 && by > l.y - 6 && by - m.vy * DT <= l.y + 12) {
        m.vy = -Math.max(1250, m.vy * 1.05);
        l.bounceT = w.t;
        ev(w, 'bounce', { x: m.x, y: l.y });
      }
    }
  }

  // ロープの先
  if (w.rope) {
    const R = w.rope;
    if (R.phase === 'out') {
      const tgt = R.target ? grabPoint(w, R.target) : { x: R.px, y: R.py };
      const dx = tgt.x - R.x, dy = tgt.y - R.y, d = hyp(dx, dy), s = ROPE_SPEED * DT;
      if (R.target && !grabbable(w, R.target)) { R.phase = 'back'; }
      else if (d <= s) {
        if (R.target) attach(w, R.target);
        else { R.phase = 'back'; R.x = tgt.x; R.y = tgt.y; w.whiffs++; w.combo = 0; ev(w, 'whiff', { x: tgt.x, y: tgt.y }); }
      } else { R.x += dx / d * s; R.y += dy / d * s; }
    }
    if (w.rope && w.rope.phase === 'back') {
      const dx = m.x - R.x, dy = m.y - R.y, d = hyp(dx, dy), s = ROPE_SPEED * 0.8 * DT;
      if (d <= s) w.rope = null; else { R.x += dx / d * s; R.y += dy / d * s; }
    }
  }

  if (!w.baby) {
    const b = w.anchors.find(a => a.baby);
    if (b && hyp(b.x - m.x, b.y + 30 - (m.y + BODY * 0.5)) < 95) { w.baby = true; ev(w, 'baby', { x: b.x, y: b.y }); }
  }
  // くだもの (当たり判定は見た目より大きく = 取りやすく)
  const bx = m.x, by = m.y + BODY * 0.6;
  for (const f of w.fruits) {
    if (!f.got && hyp(f.x - bx, f.y - by) < 64) { f.got = true; w.fruitsGot++; ev(w, 'fruit', { x: f.x, y: f.y, n: w.fruitsGot }); }
  }

  // 水: 最初に手を離すまで止まっている。離れすぎたら速く追いかける
  if (w.started) {
    if (w.waterPause > 0) w.waterPause -= DT;
    else {
      const gap = w.water - m.y;
      const sp = w.stage.water * (gap > 680 ? 2.6 : gap > 500 ? 1.6 : 1);
      w.water -= sp * DT;
    }
  }
  // 水に触れたか (体の中心が水面より 18 下に入ったら。見た目より甘く)
  if (!(w.invuln > w.t) && m.y + BODY > w.water + 18) splash(w);

  w.height = Math.max(w.height, Math.round((-m.y) / 40));
  if (m.y < w.goalY) {
    w.state = 'clear'; w.clearT = w.t;
    if (m.mode === 'hang') { m.mode = 'fly'; m.anchor = null; }
    ev(w, 'clear');
  }
}

export function stars(w) {
  if (w.state !== 'clear') return [false, false, false];
  return [true, w.fruitsGot >= w.fruits.length, w.whiffs === 0];
}
