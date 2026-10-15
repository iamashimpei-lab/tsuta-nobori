// つたのぼり: 絵の部品 (サル・オオハシ・葉・枝・くだもの・背景の絵)
// 描き方の決まり: 輪郭は黒でなく紫寄りのこげ茶 / 陰影は 3 段 (影・地・明るい所) で、影は色相を紫・青緑へずらす /
// 主役 (サル) が一番明るく、背景ほど青くかすませる (空気遠近)。重い絵は最初に一度だけ描いて使い回す
const OUT = '#3a1d2a';
const FUR = { base: '#a0612b', shade: '#6e3a3e', light: '#d08a48', deep: '#4e2632' };
const SKIN = { base: '#f8d6a8', shade: '#e2a586', light: '#fff0d6' };

export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const TAU = Math.PI * 2;

function sprite(w, h, scale, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  draw(g);
  return c;
}

// ---- 手足: 輪郭 → 地 → ハイライトの 3 本の線で描く ----
function limb(c, pts, w, col = FUR.base, light = FUR.light) {
  const path = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); if (pts.length === 3) c.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); else c.lineTo(pts[1][0], pts[1][1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = OUT; c.lineWidth = w + 5; path(); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; path(); c.stroke();
  c.strokeStyle = light; c.lineWidth = w * 0.3; c.globalAlpha = 0.55;
  c.save(); c.translate(-w * 0.18, -w * 0.12); path(); c.stroke(); c.restore();
  c.globalAlpha = 1;
}

function oval(c, x, y, rx, ry, fill, lw = 3.5, rot = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (lw) { c.strokeStyle = OUT; c.lineWidth = lw; c.stroke(); }
  c.fillStyle = fill; c.fill();
}

function radial(c, x, y, r, inner, outer, fx = -0.35, fy = -0.4) {
  const g = c.createRadialGradient(x + r * fx, y + r * fy, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  return g;
}

// ---- サル (原点 = ロープを握る手。体は下にぶら下がる) ----
// o: { pose: 'hang' | 'fly' | 'stand' | 'baby', t, mood: 'normal' | 'happy' | 'scared' | 'excited', hat, wave }
export function drawMonkey(c, o) {
  const t = o.t || 0;
  const pose = o.pose || 'hang';
  const mood = o.mood || 'normal';
  const sw = Math.sin(t * 6);
  // 手の位置 (ポーズで変える)
  let hl, hr, el, er, fl, fr, kl, kr;
  if (pose === 'fly') {
    hl = [-38, 22]; hr = [40, 14]; el = [-30, 44]; er = [30, 40];
    kl = [-16, 98]; kr = [18, 96]; fl = [-30, 108]; fr = [30, 104];
  } else if (pose === 'stand') {
    hl = [-26, 84]; hr = [26, 84]; el = [-24, 66]; er = [24, 66];
    kl = [-12, 108]; kr = [12, 108]; fl = [-16, 124]; fr = [16, 124];
  } else if (pose === 'baby') {
    hl = [-24, 78]; hr = [28, 30 + (o.wave || 0) * 10]; el = [-24, 62]; er = [26, 50];
    kl = [-12, 104]; kr = [12, 104]; fl = [-16, 116]; fr = [16, 116];
  } else {
    hl = [-5, 1]; hr = [5, 1]; el = [-17, 30]; er = [16, 30];
    const k = sw * 4;
    kl = [-12 - k, 104]; kr = [12 + k, 104]; fl = [-18 - k, 118]; fr = [18 + k, 116];
  }
  // 動きの上書き: 腕 (ばんざい / ばたばた / 頭をかく) と足 (ちぢめる / ばたばた / ぶらぶら / 歩く)
  const fast = t * 22;
  if (o.arms === 'cheer') {
    const wv = Math.sin(t * 14) * 8;
    hl = [-30, -14 + wv]; el = [-28, 24]; hr = [30, -14 - wv]; er = [28, 24];
  } else if (o.arms === 'flail') {
    hl = [-36 + Math.cos(fast) * 9, 18 + Math.sin(fast) * 12]; el = [-28, 42];
    hr = [38 + Math.cos(fast + 2) * 9, 12 + Math.sin(fast + 2) * 12]; er = [28, 40];
  } else if (o.arms === 'scratch') {
    hr = [18, 6]; er = [30, 30];
  }
  if (o.legs === 'tuck') {
    kl = [-20, 84]; fl = [-8, 98]; kr = [20, 84]; fr = [8, 98];
  } else if (o.legs === 'flail') {
    const a = Math.sin(fast) * 14, b = Math.sin(fast + 1.7) * 14;
    kl = [-16 + a * 0.4, 100]; fl = [-24 + a, 114]; kr = [16 + b * 0.4, 100]; fr = [24 + b, 112];
  } else if (o.legs === 'dangle') {
    const a = Math.sin(t * 5) * 10, b = Math.sin(t * 5 + 2.4) * 10;
    kl = [-12 + a * 0.3, 104]; fl = [-16 + a, 119]; kr = [12 + b * 0.3, 104]; fr = [16 + b, 118];
  } else if (o.legs === 'walk') {
    const a = Math.sin(t * 16) * 9;
    kl = [-12 + a * 0.5, 106]; fl = [-14 + a, 124]; kr = [12 - a * 0.5, 106]; fr = [14 - a, 124];
  }
  const earW = (o.ear || 0) * Math.sin(t * 30) * 3;
  const look = o.look || [0, 0];
  // しっぽ (いちばん奥)
  const tw = Math.sin(t * 3.2) * 10;
  c.lineCap = 'round';
  const tail = () => { c.beginPath(); c.moveTo(-4, 92); c.bezierCurveTo(-34, 120, -74 + tw, 112, -70 + tw, 80); c.bezierCurveTo(-67 + tw, 58, -44 + tw, 62, -48 + tw, 76); };
  c.strokeStyle = OUT; c.lineWidth = 12; tail(); c.stroke();
  c.strokeStyle = FUR.shade; c.lineWidth = 7.5; tail(); c.stroke();
  c.strokeStyle = FUR.base; c.lineWidth = 3; c.save(); c.translate(-1.5, -1.5); tail(); c.stroke(); c.restore();
  // 足 (奥の足は影色)
  limb(c, [[-9, 92], kl, fl], 10, FUR.shade, FUR.base);
  limb(c, [[9, 92], kr, fr], 10, FUR.base, FUR.light);
  oval(c, fl[0] - 3, fl[1] + 1, 7.5, 5, SKIN.shade, 3, -0.3);
  oval(c, fr[0] + 3, fr[1] + 1, 7.5, 5, SKIN.base, 3, 0.3);
  // 奥の腕
  limb(c, [[-14, 60], el, hl], 9, FUR.shade, FUR.base);
  // 体 (洋なし形)
  c.beginPath();
  c.moveTo(0, 50); c.bezierCurveTo(26, 50, 28, 100, 2, 104); c.bezierCurveTo(-26, 104, -26, 52, 0, 50);
  c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
  c.fillStyle = radial(c, 0, 76, 28, FUR.light, FUR.shade); c.fill();
  c.beginPath(); c.ellipse(1, 82, 12, 17, 0, 0, TAU); c.fillStyle = radial(c, 1, 82, 17, SKIN.light, SKIN.shade); c.fill();
  // 手前の腕
  limb(c, [[14, 60], er, hr], 9, FUR.base, FUR.light);
  // 頭: 耳 → 頭 → 毛束 → 顔
  for (const s of [-1, 1]) {
    oval(c, s * 30, 30 + earW * s, 12, 12.5, radial(c, s * 30, 30, 12, FUR.light, FUR.shade), 4);
    oval(c, s * 30, 31 + earW * s, 6.5, 7, SKIN.shade, 0);
  }
  c.beginPath(); c.ellipse(0, 30, 28, 26.5, 0, 0, TAU);
  c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
  c.fillStyle = radial(c, 0, 30, 28, FUR.light, FUR.shade); c.fill();
  // 頭のてっぺんの毛
  c.beginPath(); c.moveTo(-8, 6); c.quadraticCurveTo(-4, -6, 2, 5); c.quadraticCurveTo(6, -8, 10, 6); c.closePath();
  c.strokeStyle = OUT; c.lineWidth = 3; c.stroke(); c.fillStyle = FUR.base; c.fill();
  // 顔 (ハート形)
  c.beginPath();
  c.moveTo(0, 22); c.bezierCurveTo(-4, 13, -21, 12, -21, 28); c.bezierCurveTo(-21, 40, -14, 52, 0, 53);
  c.bezierCurveTo(14, 52, 21, 40, 21, 28); c.bezierCurveTo(21, 12, 4, 13, 0, 22); c.closePath();
  c.strokeStyle = FUR.deep; c.lineWidth = 2; c.stroke();
  c.fillStyle = radial(c, 0, 34, 22, SKIN.light, SKIN.base, -0.2, -0.5); c.fill();
  // 目 (まばたきあり。黒目は進む方向を見る)
  const blink = (t % 3.7) < 0.12 && mood !== 'happy';
  const lx = look[0] * 2.2, ly = look[1] * 2.2;
  if (mood === 'hurt') {
    c.strokeStyle = OUT; c.lineWidth = 3; c.lineCap = 'round';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 14, 25); c.lineTo(s * 6, 29); c.lineTo(s * 14, 33); c.stroke(); }
  } else if (mood === 'happy' || blink) {
    c.strokeStyle = OUT; c.lineWidth = 3; c.lineCap = 'round';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 9, mood === 'happy' ? 31 : 29, 5, Math.PI + 0.2, -0.2); c.stroke(); }
  } else {
    const ry = mood === 'scared' ? 8.5 : 7.5;
    for (const s of [-1, 1]) {
      c.beginPath(); c.ellipse(s * 9, 29, 5.6, ry, 0, 0, TAU); c.fillStyle = '#2a1420'; c.fill();
      c.beginPath(); c.ellipse(s * 9 + 0.5 + lx * 0.5, 31 + ly * 0.5, 3.4, ry * 0.55, 0, 0, TAU); c.fillStyle = '#5a2e3a'; c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(s * 9 + 2 + lx, 25.5 + ly, 2.4, 0, TAU); c.fill();
      c.beginPath(); c.arc(s * 9 - 2 + lx, 32.5 + ly, 1.1, 0, TAU); c.fill();
    }
  }
  // まゆ
  c.strokeStyle = FUR.deep; c.lineWidth = 2.4;
  for (const s of [-1, 1]) {
    c.beginPath();
    if (mood === 'scared' || mood === 'hurt') { c.moveTo(s * 4, 18); c.quadraticCurveTo(s * 9, 15, s * 14, 20); }
    else if (mood === 'confused' && s > 0) { c.moveTo(s * 4, 15); c.quadraticCurveTo(s * 9, 11, s * 14, 14); }
    else { c.moveTo(s * 4, 19); c.quadraticCurveTo(s * 9, 16, s * 14, 18); }
    c.stroke();
  }
  // 口もと
  c.beginPath(); c.ellipse(0, 43, 11, 8, 0, 0, TAU); c.fillStyle = SKIN.light; c.fill();
  c.fillStyle = '#7a3b3a'; c.beginPath(); c.ellipse(-2.6, 39.5, 1.4, 1.1, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(2.6, 39.5, 1.4, 1.1, 0, 0, TAU); c.fill();
  c.strokeStyle = '#6b2f33'; c.lineWidth = 2.2; c.lineCap = 'round';
  if (mood === 'excited' || pose === 'fly') {
    c.beginPath(); c.ellipse(0, 46, 4.5, 4, 0, 0, TAU); c.fillStyle = '#7a2a33'; c.fill();
    c.beginPath(); c.ellipse(0, 48, 3, 1.8, 0, 0, TAU); c.fillStyle = '#ff8a8a'; c.fill();
  } else if (mood === 'confused') {
    c.beginPath(); c.ellipse(2, 46, 2.6, 2.2, 0, 0, TAU); c.fillStyle = '#7a2a33'; c.fill();
  } else if (mood === 'scared' || mood === 'hurt') {
    c.beginPath(); c.moveTo(-5, 47); c.quadraticCurveTo(-2.5, 44, 0, 47); c.quadraticCurveTo(2.5, 50, 5, 47); c.stroke();
  } else {
    c.beginPath(); c.arc(0, 43, 6.5, 0.35, Math.PI - 0.35); c.stroke();
  }
  // ほお
  c.fillStyle = 'rgba(255,110,130,0.35)';
  c.beginPath(); c.ellipse(-15, 40, 4.5, 2.8, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(15, 40, 4.5, 2.8, 0, 0, TAU); c.fill();
  if (mood === 'scared' || mood === 'hurt') { c.fillStyle = '#a8e2ff'; c.beginPath(); c.moveTo(27, 10); c.quadraticCurveTo(33, 20, 27, 22); c.quadraticCurveTo(21, 20, 27, 10); c.fill(); }
  // 手 (ロープを握る手は頭より手前)
  oval(c, hl[0], hl[1], 6.5, 6, SKIN.base, 3);
  oval(c, hr[0], hr[1], 6.5, 6, SKIN.light, 3);
  if (o.hat) drawHat(c, o.hat);
}

function drawHat(c, kind) {
  if (kind === 'leaf') {
    c.beginPath(); c.moveTo(-22, 10); c.quadraticCurveTo(0, -14, 24, 6); c.quadraticCurveTo(2, 14, -22, 10);
    c.strokeStyle = '#1f4a2a'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#5cc05a'; c.fill();
    c.strokeStyle = '#a8e88a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-18, 9); c.lineTo(20, 5); c.stroke();
  } else if (kind === 'flower') {
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; oval(c, 16 + Math.cos(a) * 8, 8 + Math.sin(a) * 8, 6.5, 6.5, '#ff8fb0', 2); }
    oval(c, 16, 8, 4.5, 4.5, '#ffd23f', 2);
  } else if (kind === 'crown') {
    c.beginPath(); c.moveTo(-18, 12); c.lineTo(-18, -6); c.lineTo(-9, 3); c.lineTo(0, -12); c.lineTo(9, 3); c.lineTo(18, -6); c.lineTo(18, 12); c.closePath();
    c.strokeStyle = '#7a4a00'; c.lineWidth = 3; c.stroke();
    const g = c.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#e0a010'); c.fillStyle = g; c.fill();
    oval(c, 0, 5, 3.5, 3.5, '#ff4f7b', 1.5);
  }
}

// ---- オオハシ (原点 = つかむ足) ----
export function drawToucan(c, t, o = {}) {
  const flap = Math.sin(t * (o.tired ? 30 : 16) + (o.phase || 0));
  c.save(); c.scale(o.dir || 1, 1);
  // 奥の羽
  c.save(); c.translate(-6, -30); c.rotate(-0.5 - flap * 0.6);
  c.beginPath(); c.ellipse(-16, -6, 34, 13, -0.3, 0, TAU); c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke(); c.fillStyle = '#1b2240'; c.fill();
  c.restore();
  // 尾
  c.beginPath(); c.moveTo(-34, -24); c.lineTo(-64, -14); c.lineTo(-60, -2); c.lineTo(-30, -14); c.closePath();
  c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke(); c.fillStyle = '#20263f'; c.fill();
  // 体
  c.beginPath(); c.ellipse(-6, -24, 34, 22, -0.12, 0, TAU); c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
  c.fillStyle = radial(c, -6, -24, 34, '#3a4670', '#141a30'); c.fill();
  // 胸の白とお腹の赤
  c.beginPath(); c.ellipse(16, -22, 14, 15, 0.2, 0, TAU); c.fillStyle = '#fff8e8'; c.fill();
  c.beginPath(); c.ellipse(6, -8, 10, 5, 0, 0, TAU); c.fillStyle = '#ff5a4a'; c.fill();
  // くちばし (大きく、黄 → だいだい → 先が赤)
  c.save(); c.translate(26, -30);
  c.beginPath(); c.moveTo(0, -9); c.bezierCurveTo(26, -16, 52, -6, 58, 6); c.bezierCurveTo(44, 8, 20, 10, 0, 9); c.closePath();
  c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke();
  const g = c.createLinearGradient(0, 0, 58, 0); g.addColorStop(0, '#ffe14d'); g.addColorStop(0.6, '#ff9f1c'); g.addColorStop(1, '#e6402e'); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(80,30,10,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(2, 2); c.quadraticCurveTo(30, 0, 54, 5); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(18, -7, 12, 2.5, -0.1, 0, TAU); c.fill();
  c.restore();
  // 目 (青い輪)
  oval(c, 20, -33, 7, 7, '#5ab8ff', 2.5); oval(c, 21, -33, 3.2, 3.6, '#101010', 0);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(22.2, -34.5, 1.3, 0, TAU); c.fill();
  // 手前の羽
  c.save(); c.translate(-4, -28); c.rotate(-0.25 + flap * 0.7);
  c.beginPath(); c.ellipse(-12, -4, 30, 12, -0.25, 0, TAU); c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke();
  c.fillStyle = radial(c, -12, -4, 30, '#4a5a90', '#1b2240'); c.fill();
  c.restore();
  // 足
  c.strokeStyle = '#e07a1c'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-6, -4); c.lineTo(-4, 4); c.moveTo(2, -4); c.lineTo(4, 4); c.stroke();
  if (o.tired) { c.fillStyle = '#a8e2ff'; c.beginPath(); c.moveTo(30, -56); c.quadraticCurveTo(36, -46, 30, -44); c.quadraticCurveTo(24, -46, 30, -56); c.fill(); }
  c.restore();
}

// ---- 葉: 先のとがった葉を重ねたかたまり (奥ほど青緑に暗く) ----
const leafCache = new Map();
function leafShape(c, len, wid) {
  c.beginPath(); c.moveTo(0, 0);
  c.bezierCurveTo(len * 0.25, -wid, len * 0.75, -wid * 0.9, len, 0);
  c.bezierCurveTo(len * 0.75, wid * 0.9, len * 0.25, wid, 0, 0); c.closePath();
}
export function leafSprite(seed, r, flower = false) {
  const key = `${seed}|${Math.round(r)}|${flower}`;
  if (leafCache.has(key)) return leafCache.get(key);
  const S = r * 2.6;
  const spr = sprite(S, S, 2, (c) => {
    c.translate(S / 2, S / 2);
    const leaves = [];
    for (let k = 0; k < 26; k++) {
      const a = hash(seed * 7.1 + k) * TAU;
      const d = Math.sqrt(hash(seed * 3.3 + k)) * r * 0.55;
      leaves.push({ a, d, z: hash(seed * 9.7 + k), len: r * (0.55 + hash(seed + k * 1.7) * 0.35), rot: a + (hash(seed * 5 + k) - 0.5) * 0.9 });
    }
    leaves.sort((p, q) => p.z - q.z);
    for (const L of leaves) {
      const x = Math.cos(L.a) * L.d, y = Math.sin(L.a) * L.d * 0.62 - L.z * r * 0.12;
      c.save(); c.translate(x, y); c.rotate(L.rot);
      const tone = L.z < 0.3 ? ['#1d4f4c', '#17403e'] : L.z < 0.65 ? ['#3a8f4e', '#24624a'] : ['#69c15a', '#3a8f4e'];
      leafShape(c, L.len, L.len * 0.32);
      const g = c.createLinearGradient(0, -L.len * 0.3, 0, L.len * 0.3); g.addColorStop(0, tone[0]); g.addColorStop(1, tone[1]);
      c.fillStyle = g; c.fill();
      c.strokeStyle = '#123532'; c.lineWidth = 1.6; c.stroke();
      if (L.z > 0.3) { c.strokeStyle = L.z > 0.65 ? 'rgba(220,255,170,0.7)' : 'rgba(150,220,140,0.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2, 0); c.lineTo(L.len * 0.85, 0); c.stroke(); }
      c.restore();
    }
    if (flower) {
      for (let k = 0; k < 2; k++) {
        const x = (hash(seed + k * 11) - 0.5) * r * 0.9, y = (hash(seed + k * 13) - 0.6) * r * 0.5;
        for (let p = 0; p < 5; p++) {
          const a = p / 5 * TAU + k;
          c.save(); c.translate(x, y); c.rotate(a);
          c.beginPath(); c.ellipse(7, 0, 8, 5, 0, 0, TAU); c.fillStyle = k ? '#ff6f61' : '#ff8fb0'; c.fill();
          c.strokeStyle = '#7a1f3a'; c.lineWidth = 1.2; c.stroke(); c.restore();
        }
        oval(c, x, y, 3.5, 3.5, '#ffe14d', 1.2);
      }
    }
  });
  const out = { img: spr, size: S };
  leafCache.set(key, out);
  return out;
}
export function drawLeaves(c, x, y, r, seed, flower) {
  const s = leafSprite(seed % 12, Math.round(r / 8) * 8, flower);
  c.drawImage(s.img, x - s.size / 2, y - s.size / 2, s.size, s.size);
}

// ---- 枝: 根元が太く先が細い、樹皮の筋とこぶ ----
export function drawBranch(c, x0, y0, cx, cy, x1, y1, wb, wt, seed) {
  const N = 16, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1;
    const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1;
    const dx = 2 * (1 - u) * (cx - x0) + 2 * u * (x1 - cx), dy = 2 * (1 - u) * (cy - y0) + 2 * u * (y1 - cy);
    const l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const w = (wb + (wt - wb) * u) / 2;
    top.push([x + nx * w, y + ny * w]); bot.push([x - nx * w, y - ny * w]);
  }
  c.beginPath(); c.moveTo(top[0][0], top[0][1]);
  for (const p of top) c.lineTo(p[0], p[1]);
  for (let i = bot.length - 1; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1]);
  c.closePath();
  c.strokeStyle = OUT; c.lineWidth = 3.5; c.lineJoin = 'round'; c.stroke();
  const g = c.createLinearGradient(0, Math.min(y0, y1) - wb, 0, Math.max(y0, y1) + wb);
  g.addColorStop(0, '#9a6a3a'); g.addColorStop(0.5, '#6e4428'); g.addColorStop(1, '#45283a');
  c.fillStyle = g; c.fill();
  // 樹皮の筋
  c.strokeStyle = 'rgba(40,20,40,0.45)'; c.lineWidth = 1.6;
  for (let k = 0; k < 3; k++) {
    const off = (k - 1) * 0.28;
    c.beginPath();
    for (let i = 1; i < N; i++) {
      const p = top[i], q = bot[i];
      const x = p[0] + (q[0] - p[0]) * (0.5 + off), y = p[1] + (q[1] - p[1]) * (0.5 + off);
      if (hash(seed * 3 + i + k * 7) > 0.35) (i === 1 ? c.moveTo(x, y) : c.lineTo(x, y)); else c.moveTo(x, y);
    }
    c.stroke();
  }
  // 上側のハイライト
  c.strokeStyle = 'rgba(255,220,160,0.35)'; c.lineWidth = 2;
  c.beginPath(); for (let i = 1; i < N - 1; i++) { const p = top[i], q = bot[i]; const x = p[0] + (q[0] - p[0]) * 0.18, y = p[1] + (q[1] - p[1]) * 0.18; i === 1 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
  // こぶ
  const ki = 4 + Math.floor(hash(seed) * 6), p = top[ki], q = bot[ki];
  oval(c, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, wb * 0.2, wb * 0.14, '#5a3424', 1.5);
}

// ---- くだもの ----
export function drawFruit(c, kind, t) {
  if (kind === 0) {
    // バナナの房
    for (let k = 0; k < 3; k++) {
      c.save(); c.rotate((k - 1) * 0.35);
      c.beginPath(); c.moveTo(-2, -16); c.bezierCurveTo(-18, -4, -14, 18, 6, 22); c.bezierCurveTo(-2, 12, -4, -2, 4, -14); c.closePath();
      c.strokeStyle = '#6b4300'; c.lineWidth = 2.5; c.stroke();
      const g = c.createLinearGradient(-14, 0, 6, 0); g.addColorStop(0, '#ffe76a'); g.addColorStop(1, '#e8a91c'); c.fillStyle = g; c.fill();
      c.restore();
    }
    oval(c, 1, -16, 4, 3.5, '#6b8a2a', 2);
  } else if (kind === 1) {
    c.beginPath(); c.ellipse(0, 2, 15, 18, 0.4, 0, TAU); c.strokeStyle = '#6b1f10'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = radial(c, 0, 2, 18, '#ffd24a', '#e8452e'); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(-5, -6, 4, 6, 0.4, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-2, -15); c.quadraticCurveTo(6, -26, 16, -20); c.quadraticCurveTo(6, -14, -2, -15); c.strokeStyle = '#1f4a2a'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#5cc05a'; c.fill();
  } else {
    // ベリー 3 つ
    for (const [x, y] of [[-7, 3], [7, 3], [0, -7]]) {
      c.beginPath(); c.arc(x, y, 8.5, 0, TAU); c.strokeStyle = '#3a0a28'; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = radial(c, x, y, 8.5, '#ff6fa8', '#8a1450'); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(x - 3, y - 3, 2.2, 0, TAU); c.fill();
    }
    c.beginPath(); c.moveTo(0, -15); c.quadraticCurveTo(-10, -22, -16, -14); c.strokeStyle = '#2f6a2a'; c.lineWidth = 3; c.stroke();
  }
}

// ---- 背景の絵 (縦につなげて並べられる 1 枚。最初に一度だけ描く) ----
export function makeBackdrop(W, H, layer) {
  return sprite(W, H, 1, (c) => {
    const n = layer === 0 ? 11 : 7;
    for (let k = 0; k < n; k++) {
      const x = (k + hash(k * 3.7 + layer) * 0.8) * (W / n);
      const w = (layer === 0 ? 40 : 70) + hash(k + layer * 5) * (layer === 0 ? 50 : 70);
      const col = layer === 0 ? ['#14403e', '#0e302f'] : ['#22503e', '#173a30'];
      const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, col[1]); g.addColorStop(0.35, col[0]); g.addColorStop(1, col[1]);
      c.fillStyle = g; c.fillRect(x - w / 2, 0, w, H);
      c.strokeStyle = 'rgba(0,10,20,0.25)'; c.lineWidth = 3;
      for (let j = 0; j < 9; j++) { const yy = hash(k * 13 + j) * H; c.beginPath(); c.moveTo(x - w * 0.3, yy); c.quadraticCurveTo(x, yy + 30, x - w * 0.1, yy + 70); c.stroke(); }
      // つる (幹に巻きつく / 垂れる)
      c.strokeStyle = layer === 0 ? 'rgba(60,110,80,0.5)' : 'rgba(90,150,80,0.6)'; c.lineWidth = layer === 0 ? 3 : 4;
      const vx = x + w * (hash(k + 0.5) - 0.5);
      c.beginPath(); for (let yy = 0; yy <= H; yy += 20) c.lineTo(vx + Math.sin(yy * 0.02 + k) * 16, yy); c.stroke();
    }
    // 葉のかたまり (上下につながるよう、はみ出す分は反対側にも描く)
    const m = layer === 0 ? 16 : 12;
    for (let k = 0; k < m; k++) {
      const x = hash(k * 5.1 + layer * 2) * W, y = hash(k * 7.3 + layer) * H, r = (layer === 0 ? 60 : 80) + hash(k) * 50;
      for (const dy of [-H, 0, H]) {
        if (y + dy < -r * 1.4 || y + dy > H + r * 1.4) continue;
        c.globalAlpha = layer === 0 ? 0.45 : 0.75;
        drawLeaves(c, x, y + dy, r, k + layer * 20, layer === 1 && k % 4 === 0);
      }
    }
    c.globalAlpha = 1;
    // 霧 (空気遠近): 全体を青くかすませる
    c.fillStyle = layer === 0 ? 'rgba(40,90,90,0.45)' : 'rgba(30,70,60,0.22)';
    c.fillRect(0, 0, W, H);
  });
}

// ---- 両側の大きな幹の模様 (縦につながる) ----
export function makeTrunk(Wd, H, side) {
  return sprite(Wd, H, 1.5, (c) => {
    const g = c.createLinearGradient(0, 0, Wd, 0);
    const cols = ['#3e2238', '#6a4128', '#8e5e34', '#6a4128', '#3e2238'];
    cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
    c.fillStyle = g; c.fillRect(0, 0, Wd, H);
    // 縦の割れ目
    for (let k = 0; k < 9; k++) {
      const x = 10 + hash(k * 3.1 + side) * (Wd - 20);
      c.strokeStyle = 'rgba(30,12,30,0.55)'; c.lineWidth = 2 + hash(k) * 3;
      c.beginPath();
      for (let y = -20; y <= H + 20; y += 24) c.lineTo(x + Math.sin(y * 0.03 + k * 2) * 6, y);
      c.stroke();
      c.strokeStyle = 'rgba(255,210,150,0.12)'; c.lineWidth = 1.5;
      c.beginPath(); for (let y = -20; y <= H + 20; y += 24) c.lineTo(x + 3 + Math.sin(y * 0.03 + k * 2) * 6, y); c.stroke();
    }
    // こけと、きのこ
    for (let k = 0; k < 7; k++) {
      const y = hash(k * 9.1 + side) * H, x = side ? 8 : Wd - 8;
      for (const dy of [-H, 0, H]) {
        c.fillStyle = 'rgba(110,190,90,0.55)';
        c.beginPath(); c.ellipse(x, y + dy, 16, 46, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(160,230,120,0.45)';
        c.beginPath(); c.ellipse(x + (side ? 4 : -4), y + dy - 10, 8, 22, 0, 0, TAU); c.fill();
      }
    }
    for (let k = 0; k < 3; k++) {
      const y = hash(k * 4.4 + side * 3) * (H - 80) + 40, x = side ? 6 : Wd - 6;
      for (let j = 0; j < 2; j++) {
        c.beginPath(); c.ellipse(x + (side ? 14 : -14), y + j * 16, 20, 7, side ? 0.15 : -0.15, Math.PI, TAU);
        c.strokeStyle = '#5a2a1a'; c.lineWidth = 2; c.stroke(); c.fillStyle = j ? '#e08a4a' : '#f0a860'; c.fill();
      }
    }
  });
}

// ---- 手前の大きな葉 (画面の端に、暗いシルエットで奥行きを出す)。切れ込みは別の絵の上で抜く ----
const frondCache = new Map();
export function frondSprite(col) {
  if (frondCache.has(col)) return frondCache.get(col);
  // 手前のモンステラの葉 (茎の付け根 = 左端の中央)
  const spr = sprite(300, 240, 1.5, (c) => {
    c.translate(10, 120);
    const leaf = () => {
      c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(30, -110, 230, -120, 280, -10);
      c.bezierCurveTo(250, 90, 60, 120, 0, 0); c.closePath();
    };
    const g = c.createLinearGradient(0, -100, 0, 100); g.addColorStop(0, '#173f30'); g.addColorStop(1, col);
    leaf(); c.fillStyle = g; c.fill();
    // 葉脈
    c.strokeStyle = 'rgba(120,180,120,0.35)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(140, -20, 270, -12); c.stroke();
    c.lineWidth = 2;
    for (let k = 1; k <= 6; k++) {
      const x = k * 38, y = -k * 3;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 18, y - 40, x + 28, y - 78 + k * 6); c.stroke();
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 18, y + 40, x + 26, y + 80 - k * 7); c.stroke();
    }
    // ふちの切れ込みと穴 (この絵の上だけで抜く)
    c.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 4; k++) {
      const x = 70 + k * 45;
      c.beginPath(); c.moveTo(x + 10, -104 + k * 8); c.lineTo(x + 2, -60 + k * 6); c.lineTo(x + 14, -62 + k * 6); c.lineTo(x + 26, -100 + k * 8); c.fill();
      c.beginPath(); c.moveTo(x + 10, 98 - k * 9); c.lineTo(x + 2, 58 - k * 6); c.lineTo(x + 14, 60 - k * 6); c.lineTo(x + 26, 94 - k * 9); c.fill();
      c.beginPath(); c.ellipse(x + 20, -28 + (k % 2) * 56, 7, 4, 0, 0, TAU); c.fill();
    }
  });
  frondCache.set(col, spr);
  return spr;
}
