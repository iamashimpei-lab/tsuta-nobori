// つたのぼり: 描画
// 色の役割 (550 Atelier の手順より): サル = 暖色 / つかめる物 = 黄色い光の輪 / 危険 = ピンク・赤 / 背景 = 暗く彩度低め
// 影は黒を混ぜず、色相を紫・青緑へずらして暗くする。一番明るいのはサル、次につかめる物、背景が一番暗い
import { WORLD_W, WALL_L, WALL_R, BODY, anchorPos, grabPoint, grabbable } from './game.js';
import { drawMonkey, drawToucan, drawLeaves, drawBranch, drawFruit, makeBackdrop, makeTrunk, frondSprite } from './art.js';

const FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP",sans-serif';
const PAL = {
  fur: '#9a5f2c', furShade: '#6b3b3a', furLight: '#c98448', skin: '#f6d2a2', skinShade: '#d9a07f',
  leaf: '#4fae55', leafMid: '#3d9150', leafShade: '#22545a', leafLight: '#86d46a',
  bark: '#6a4428', barkShade: '#3e2a3c', barkLight: '#8e6136',
  grab: '#ffe27a', danger: '#ff4f7b', water: '#3b9fe0', waterDeep: '#183a78',
};

function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function mixHex(c1, c2, t) {
  const a = c1.match(/\w\w/g).map(h => parseInt(h, 16)), b = c2.match(/\w\w/g).map(h => parseInt(h, 16));
  return 'rgb(' + a.map((v, k) => Math.round(lerp(v, b[k], t))).join(',') + ')';
}
const easeOutBack = t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const R = { last: {}, scale: 1, dpr: 1, viewH: 900, camY: 0, camInit: false, shake: 0, particles: [], texts: [], flash: 0, squash: 1, stretch: 0, ringT: -9, hint: null };

  R.resize = () => {
    R.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    canvas.width = Math.round(cw * R.dpr); canvas.height = Math.round(ch * R.dpr);
    R.scale = cw / WORLD_W;
    R.viewH = ch / R.scale;
  };

  R.reset = () => { R.last = {}; R.camInit = false; R.particles = []; R.texts = []; R.flash = 0; R.shake = 0; R.hint = null; R.ringT = -9; R.squash = 1; };

  // ---- 出来事から演出を作る ----
  R.onEvents = (w, evs) => {
    for (const e of evs) {
      R.last[e.type] = w.t;
      if (e.type === 'release' && e.nice) R.last.nice = w.t;
      if (e.type === 'attach') {
        burst(e.x, e.y, 12, ['#7fd16a', '#4fae55', '#b8ea7a'], 320, 0.7, 'leaf');
        R.squash = 0.72;
        if (e.combo >= 3) R.texts.push({ s: `${e.combo}れんぞく！`, x: e.x, y: e.y - 70, t: w.t, c: e.combo >= 6 ? '#ffd23f' : '#ffffff', size: 30 + Math.min(e.combo, 10) * 2 });
        R.shake = Math.max(R.shake, e.combo >= 5 ? 7 : 3);
      } else if (e.type === 'release') {
        if (e.nice) { R.ringT = w.t; R.texts.push({ s: 'ナイス！', x: e.x + 60, y: e.y + 90, t: w.t, c: '#ffd23f', size: 30 }); }
      } else if (e.type === 'fruit') {
        burst(e.x, e.y, 14, ['#fff3a0', '#ffd23f', '#ffffff'], 260, 0.55, 'star');
        R.texts.push({ s: '+1', x: e.x, y: e.y - 30, t: w.t, c: '#fff3a0', size: 32 });
      } else if (e.type === 'whiff') {
        R.texts.push({ s: 'スカッ', x: e.x, y: e.y, t: w.t, c: '#ffffff', size: 40, stroke: '#9b1035' });
      } else if (e.type === 'splash') {
        burst(e.x, e.y, 30, ['#d9f3ff', '#ffffff', '#8fd3ff'], 520, 0.9, 'drop', -1);
        R.shake = Math.max(R.shake, 16); R.flash = 0.25;
      } else if (e.type === 'bounce') {
        burst(e.x, e.y, 12, ['#9be15d', '#ffffff'], 300, 0.5, 'leaf');
        R.shake = Math.max(R.shake, 8); R.texts.push({ s: 'ボヨーン', x: e.x, y: e.y - 40, t: w.t, c: '#c8ff8a', size: 34 });
      } else if (e.type === 'kick') {
        burst(e.x, e.y + 40, 8, ['#c9a06a', '#ffffff'], 260, 0.45, 'chip');
        R.shake = Math.max(R.shake, 6); R.texts.push({ s: 'キック！', x: e.x + (e.x < WORLD_W / 2 ? 90 : -90), y: e.y, t: w.t, c: '#ffcf8a', size: 28 });
      } else if (e.type === 'loop') {
        R.shake = Math.max(R.shake, 10); R.texts.push({ s: 'ぐるりん！', x: e.x, y: e.y - 80, t: w.t, c: '#ffd23f', size: 40 });
      } else if (e.type === 'creak') {
        R.texts.push({ s: e.level === 1 ? 'ミシッ' : 'ピキピキ', x: e.x + 40, y: e.y - 40, t: w.t, c: '#ffb3c6', size: 28, stroke: '#7a1030' });
      } else if (e.type === 'break') {
        burst(e.x, e.y, 16, ['#8e6136', '#c9a06a', '#4fae55'], 380, 0.9, 'chip');
        R.shake = Math.max(R.shake, 10); R.texts.push({ s: 'ポキッ！', x: e.x, y: e.y - 40, t: w.t, c: '#ff8fb0', size: 40, stroke: '#7a1030' });
      } else if (e.type === 'baby') {
        burst(e.x, e.y, 20, ['#ffd23f', '#ff8fb0', '#ffffff'], 300, 0.9, 'star');
        R.texts.push({ s: '子ザルを たすけた！', x: e.x, y: e.y - 90, t: w.t, c: '#ffe27a', size: 36, life: 1.6 });
      } else if (e.type === 'clear') {
        R.flash = 0.6; R.shake = 12;
        burst(w.m.x, w.m.y, 80, ['#ffd23f', '#ff6b8a', '#6bd0ff', '#9be15d', '#ffffff'], 700, 1.6, 'conf');
      } else if (e.type === 'birdTired') {
        R.texts.push({ s: 'つかれた〜', x: e.x, y: e.y - 50, t: w.t, c: '#bfe7ff', size: 26, stroke: '#123a5a' });
      } else if (e.type === 'land') {
        burst(e.x, e.y, 10, ['#b08a5a', '#7fd16a'], 200, 0.5, 'chip');
      } else if (e.type === 'regrow') {
        burst(e.x, e.y, 10, ['#86d46a', '#ffffff'], 200, 0.5, 'leaf');
        R.texts.push({ s: 'にょきっ', x: e.x, y: e.y - 40, t: w.t, c: '#c8ff8a', size: 26 });
      }
    }
    function burst(x, y, n, cols, spd, life, shape, upward = 0) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.35 + Math.random() * 0.8);
        let vx = Math.cos(a) * v, vy = Math.sin(a) * v;
        if (upward) { vx *= 0.45; vy = -Math.abs(vy) * 1.5; }
        R.particles.push({ x, y, vx, vy, t: w.t, life: life * (0.7 + Math.random() * 0.5), c: cols[k % cols.length], shape, r: 4 + Math.random() * 5, spin: Math.random() * 6 });
      }
    }
  };

  const sx = x => x; // 横は世界座標そのまま (拡大は transform で)
  let C = { y: 0 };

  function camera(w, dt) {
    const m = w.m;
    let ty = m.y - R.viewH * 0.08;
    // 水が迫っている時は水も見せる
    const wantBottom = w.water + 40;
    if (wantBottom - ty > R.viewH * 0.5) ty = Math.max(ty, wantBottom - R.viewH * 0.5 - R.viewH * 0.02);
    ty = Math.min(ty, m.y + R.viewH * 0.18);
    if (w.state === 'clear') ty = m.y - R.viewH * 0.05;
    if (!R.camInit) { R.camY = ty; R.camInit = true; }
    R.camY += (ty - R.camY) * Math.min(1, dt * 5);
  }

  // 手前の葉 (視差 1.25、両端の幹の上だけ) と光の粒
  function foreground(t) {
    const top = R.camY - R.viewH / 2;
    const fr = frondSprite('#0a2219');
    const par = 1.25, SP = 520;
    const base = -R.camY * (par - 1);
    const k0 = Math.floor((top - base - 200) / SP), k1 = Math.floor((top + R.viewH - base + 200) / SP);
    for (let k = k0; k <= k1; k++) {
      const y = base + k * SP + hash(k) * 160;
      const left = k % 2 === 0;
      ctx.save(); ctx.translate(left ? -70 : WORLD_W + 70, y);
      if (!left) ctx.scale(-1, 1);
      ctx.rotate(-0.25 + hash(k + 3) * 0.5 + Math.sin(t * 0.8 + k) * 0.04);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(fr, 0, -120 * 0.75, 300 * 0.75, 240 * 0.75);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 18; k++) {
      const x = (hash(k * 3.1) * WORLD_W + Math.sin(t * 0.4 + k) * 40);
      const y = top + ((hash(k * 7.7) * R.viewH - t * (8 + hash(k) * 14)) % R.viewH + R.viewH) % R.viewH;
      const a = 0.25 + 0.25 * Math.sin(t * 2 + k);
      ctx.fillStyle = `rgba(255,240,170,${a})`;
      ctx.beginPath(); ctx.arc(x, y, 2 + hash(k + 1) * 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---- 背景 ----
  const BD_H = 1600;
  let backdrops = null, trunks = null;
  function background(w, t) {
    if (!backdrops) backdrops = [makeBackdrop(WORLD_W, BD_H, 0), makeBackdrop(WORLD_W, BD_H, 1)];
    const top = R.camY - R.viewH / 2;
    const prog = clamp(-R.camY / -w.goalY, 0, 1);
    const g = ctx.createLinearGradient(0, top, 0, top + R.viewH);
    g.addColorStop(0, mixHex('2c6a5a', 'f2d88a', Math.pow(prog, 1.6)));
    g.addColorStop(0.6, mixHex('17423a', '8fbf74', Math.pow(prog, 1.4)));
    g.addColorStop(1, mixHex('0c2626', '3f7454', prog));
    ctx.fillStyle = g; ctx.fillRect(-40, top - 40, WORLD_W + 80, R.viewH + 80);
    // 光の筋 (奥)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const x0 = k * 260 - 200 + Math.sin(t * 0.2 + k) * 20;
      ctx.fillStyle = `rgba(255,236,170,${0.03 + 0.05 * prog})`;
      ctx.beginPath(); ctx.moveTo(x0, top - 40); ctx.lineTo(x0 + 110, top - 40); ctx.lineTo(x0 + 420, top + R.viewH + 40); ctx.lineTo(x0 + 240, top + R.viewH + 40); ctx.fill();
    }
    ctx.restore();
    // 奥 (0.3) と中 (0.6) の森の絵
    for (const [img, par] of [[backdrops[0], 0.3], [backdrops[1], 0.6]]) {
      const base = R.camY * (1 - par);
      const k0 = Math.floor((top - 40 - base) / BD_H), k1 = Math.floor((top + R.viewH + 40 - base) / BD_H);
      for (let k = k0; k <= k1; k++) ctx.drawImage(img, 0, base + k * BD_H, WORLD_W, BD_H);
    }
    // 上へ行くほど日が差す色に
    ctx.fillStyle = `rgba(255,220,140,${0.18 * prog})`; ctx.fillRect(-40, top - 40, WORLD_W + 80, R.viewH + 80);
    // 霧の帯 (ゆっくり流れる)
    for (let k = 0; k < 3; k++) {
      const yy = top + ((k * 0.37 + t * 0.01) % 1) * R.viewH;
      const fg = ctx.createLinearGradient(0, yy - 60, 0, yy + 60);
      fg.addColorStop(0, 'rgba(200,240,220,0)'); fg.addColorStop(0.5, `rgba(200,240,220,${0.07 + 0.05 * prog})`); fg.addColorStop(1, 'rgba(200,240,220,0)');
      ctx.fillStyle = fg; ctx.fillRect(-40, yy - 60, WORLD_W + 80, 120);
    }
  }

  // 両側の大きな幹 (壁)
  const TR_W = 130, TR_H = 700;
  function walls(t) {
    if (!trunks) trunks = [makeTrunk(TR_W, TR_H, 0), makeTrunk(TR_W, TR_H, 1)];
    const top = R.camY - R.viewH / 2;
    const k0 = Math.floor((top - 40) / TR_H), k1 = Math.floor((top + R.viewH + 40) / TR_H);
    for (let k = k0; k <= k1; k++) {
      ctx.drawImage(trunks[0], WALL_L + 14 - TR_W, k * TR_H, TR_W, TR_H);
      ctx.drawImage(trunks[1], WALL_R - 14, k * TR_H, TR_W, TR_H);
    }
    // 幹のふちの影 (内側へ落ちる影)
    for (const [x, dir] of [[WALL_L + 14, 1], [WALL_R - 14, -1]]) {
      const g = ctx.createLinearGradient(x, 0, x + dir * 40, 0);
      g.addColorStop(0, 'rgba(10,20,25,0.45)'); g.addColorStop(1, 'rgba(10,20,25,0)');
      ctx.fillStyle = g; ctx.fillRect(dir > 0 ? x : x - 40, top - 40, 40, R.viewH + 80);
    }
  }

  function leafBlob(x, y, r, seed) {
    drawLeaves(ctx, x, y, r * 1.15, Math.abs(Math.round(seed)), Math.abs(Math.round(seed)) % 5 === 0);
  }

  function grabRing(x, y, t, id, strong) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6 + id);
    ctx.strokeStyle = `rgba(255,226,122,${(strong ? 0.75 : 0.45) + 0.25 * pulse})`; ctx.lineWidth = strong ? 4 : 3;
    ctx.beginPath(); ctx.arc(x, y, 13 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PAL.grab; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }

  function inView(y, pad = 200) { return y > R.camY - R.viewH / 2 - pad && y < R.camY + R.viewH / 2 + pad; }

  function anchors(w, t) {
    const m = w.m;
    for (const a of w.anchors) {
      if (a.kind === 'bird') continue;
      const p = anchorPos(w, a);
      const vy = a.kind === 'vine' ? p.y + a.len : p.y;
      if (!inView(p.y, 420) && !inView(vy, 300)) continue;
      const reach = Math.hypot(grabPoint(w, a).x - m.x, grabPoint(w, a).y - m.y) < 360;
      if (a.kind === 'vine') { vine(w, a, p, t, reach); continue; }
      const side = p.x < WORLD_W / 2 ? -1 : 1;
      const big = a.goal ? 1.9 : (a.size || 1);
      const r = 46 * big;
      // 枝 (幹から伸びる)
      const wx = side < 0 ? WALL_L - 10 : WALL_R + 10;
      const shake = a.kind === 'thin' && a.crack ? Math.sin(t * 60) * a.crack * 1.5 : 0;
      ctx.save(); ctx.translate(shake, 0);
      if (!(a.kind === 'thin' && a.broken)) {
        const thick = a.kind === 'thin' ? 9 : 26 * Math.min(1.3, big);
        drawBranch(ctx, wx, p.y - 60, (wx + p.x) / 2, p.y - 74, p.x, p.y - 4, thick, a.kind === 'thin' ? 4 : 9, a.id + 1);
        if (a.kind === 'thin' && a.crack) {
          // ひび (危険 = ピンク)
          ctx.strokeStyle = PAL.danger; ctx.lineWidth = 3;
          const cx = lerp(wx, p.x, 0.6), cy = p.y - 50;
          for (let k = 0; k < a.crack; k++) { ctx.beginPath(); ctx.moveTo(cx + k * 14 - 6, cy - 8); ctx.lineTo(cx + k * 14, cy); ctx.lineTo(cx + k * 14 - 4, cy + 9); ctx.stroke(); }
        }
        if (a.kind === 'thin') {
          leafBlob(lerp(wx, p.x, 0.75), p.y - 70, 22, a.id + 7);
          leafBlob(p.x, p.y - 14, 20, a.id + 8);
        } else {
          leafBlob(lerp(wx, p.x, 0.55), p.y - 70 - r * 0.2, r * 0.8, a.id + 3, 1);
          leafBlob(p.x, p.y - r * 0.35, r, a.id + 51, 1);
        }
        if (a.goal) goalMark(p.x, p.y, t);
        if (a.baby && !w.baby) babyMonkey(p.x + 30 * -side, p.y - 18, t);
        if (grabbable(w, a)) grabRing(p.x, p.y, t, a.id, reach);
      } else {
        // 折れた跡
        ctx.strokeStyle = PAL.bark; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(wx, p.y - 60); ctx.lineTo(lerp(wx, p.x, 0.3), p.y - 64); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function vine(w, a, p, t, reach) {
    const sway = Math.sin(t * 1.3 + a.x) * 10;
    leafBlob(p.x, p.y - 20, 70, a.id + 9, 1);
    ctx.lineCap = 'round';
    const hanging = w.m.mode === 'hang' && w.m.anchor === a;
    const tipX = hanging ? w.m.x : p.x + sway, tipY = hanging ? w.m.y : p.y + a.len;
    for (const [col, lw] of [[PAL.leafShade, 11], ['#5f9a3c', 7], ['#9ccf5a', 2.5]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + sway * 2, (p.y + tipY) / 2, tipX, tipY); ctx.stroke();
    }
    ctx.fillStyle = PAL.leaf;
    for (let k = 1; k < 7; k++) {
      const u = k / 7;
      const x = (1 - u) * (1 - u) * p.x + 2 * (1 - u) * u * (p.x + sway * 2) + u * u * tipX;
      const y = (1 - u) * (1 - u) * p.y + 2 * (1 - u) * u * ((p.y + tipY) / 2) + u * u * tipY;
      ctx.beginPath(); ctx.ellipse(x + (k % 2 ? 9 : -9), y, 10, 5, k % 2 ? 0.6 : -0.6, 0, Math.PI * 2); ctx.fill();
    }
    if (!hanging) grabRing(tipX, tipY, t, a.id, reach);
  }

  function goalMark(x, y, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - 60, 10, x, y - 60, 220);
    g.addColorStop(0, 'rgba(255,230,140,0.45)'); g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 230, y - 290, 460, 460); ctx.restore();
    // 旗
    ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x + 40, y - 70); ctx.lineTo(x + 40, y - 170); ctx.stroke();
    ctx.fillStyle = '#ff6b5a';
    ctx.beginPath(); ctx.moveTo(x + 42, y - 170); ctx.lineTo(x + 110 + Math.sin(t * 5) * 6, y - 152); ctx.lineTo(x + 42, y - 134); ctx.fill();
    txt('ゴール', x + 70, y - 196, 26, '#fff4c4', '#5a2a00');
  }

  function babyMonkey(x, y, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(0.55, 0.55);
    monkeyBody(t, { mode: 'baby', wave: Math.sin(t * 8) });
    ctx.restore();
    const bob = Math.sin(t * 4) * 4;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); roundRectPath(ctx, x - 58, y - 92 + bob, 116, 38, 14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, y - 56 + bob); ctx.lineTo(x + 6, y - 56 + bob); ctx.lineTo(x, y - 44 + bob); ctx.fill();
    txt('たすけて〜', x, y - 73 + bob, 20, '#7a3b10', null, '800');
  }

  function birds(w, t) {
    const m = w.m;
    for (const a of w.anchors) {
      if (a.kind !== 'bird') continue;
      const p = anchorPos(w, a);
      if (!inView(p.y, 150)) continue;
      ctx.save(); ctx.translate(p.x, p.y + 4); ctx.scale(1.15, 1.15);
      drawToucan(ctx, t, { dir: p.dir || 1, tired: a.tired && a.mode === 'carry', phase: a.phase });
      ctx.restore();
      if (grabbable(w, a)) grabRing(p.x, p.y + 4, t, a.phase, Math.hypot(p.x - m.x, p.y - m.y) < 360);
    }
  }

  function leaves(w, t) {
    for (const l of w.leaves) {
      if (!inView(l.y, 120)) continue;
      const d = t - (l.bounceT ?? -9);
      const sq = d < 0.35 ? 1 - Math.sin(d / 0.35 * Math.PI) * 0.35 * (1 - d / 0.35) : 1;
      ctx.save(); ctx.translate(l.x, l.y); ctx.scale(1 / sq * 0.95 + 0.05, sq);
      ctx.fillStyle = PAL.leafShade; ctx.beginPath(); ctx.ellipse(0, 10, l.w / 2 + 8, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5cc05a'; ctx.beginPath(); ctx.ellipse(0, 0, l.w / 2 + 4, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8fe07a'; ctx.beginPath(); ctx.ellipse(-14, -8, l.w / 2 - 22, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2f7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-l.w / 2, 2); ctx.lineTo(l.w / 2, 2); ctx.stroke();
      ctx.restore();
      // 茎
      ctx.strokeStyle = '#3d7a34'; ctx.lineWidth = 6;
      const wx = l.x < WORLD_W / 2 ? WALL_L : WALL_R;
      ctx.beginPath(); ctx.moveTo(wx, l.y + 40); ctx.quadraticCurveTo((wx + l.x) / 2, l.y + 50, l.x, l.y + 12); ctx.stroke();
    }
  }

  function fruits(w, t) {
    for (const f of w.fruits) {
      if (f.got || !inView(f.y, 60)) continue;
      const y = f.y + Math.sin(t * 3 + f.x) * 6;
      ctx.save(); ctx.translate(f.x, y);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 38);
      g.addColorStop(0, 'rgba(255,245,170,0.55)'); g.addColorStop(1, 'rgba(255,245,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(Math.sin(t * 2 + f.x) * 0.15); ctx.scale(1.25, 1.25);
      drawFruit(ctx, f.kind, t);
      ctx.restore();
    }
  }

  function ground(w) {
    if (w.ground >= w.water + 30) return;
    const top = R.camY - R.viewH / 2;
    if (w.ground > top + R.viewH + 40) return;
    // 川岸: 草 → 土 (下へ行くほど紫寄りに暗く) → 石と根
    const g = ctx.createLinearGradient(0, w.ground, 0, w.ground + 260);
    g.addColorStop(0, '#7a5434'); g.addColorStop(0.5, '#5a3c34'); g.addColorStop(1, '#2e2238');
    ctx.fillStyle = g; ctx.fillRect(-40, w.ground, WORLD_W + 80, 900);
    for (let k = 0; k < 26; k++) {
      const x = hash(k * 3.3) * WORLD_W, y = w.ground + 40 + hash(k * 7.1) * 200, r = 8 + hash(k) * 16;
      ctx.fillStyle = k % 3 ? '#6e5a58' : '#8a7468';
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.5, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const x = hash(k * 9.7) * WORLD_W;
      ctx.beginPath(); ctx.moveTo(x, w.ground + 6); ctx.quadraticCurveTo(x + 30, w.ground + 60, x + (k % 2 ? 60 : -50), w.ground + 120); ctx.stroke();
    }
    ctx.fillStyle = '#4c9a4a';
    for (let x = -20; x < WORLD_W + 20; x += 22) { ctx.beginPath(); ctx.moveTo(x, w.ground + 6); ctx.lineTo(x + 8, w.ground - 14 - hash(x) * 12); ctx.lineTo(x + 16, w.ground + 6); ctx.fill(); }
    ctx.fillStyle = '#74c25e'; ctx.fillRect(-40, w.ground - 2, WORLD_W + 80, 10);
  }

  function water(w, t) {
    const wy = w.water;
    const top = R.camY - R.viewH / 2, bot = top + R.viewH;
    if (wy > bot + 40) return;
    const g = ctx.createLinearGradient(0, wy, 0, Math.max(bot, wy + 200));
    g.addColorStop(0, 'rgba(70,165,230,0.9)'); g.addColorStop(1, 'rgba(18,48,110,0.98)');
    ctx.fillStyle = g;
    const surf = x => wy + Math.sin(x * 0.02 + t * 4) * 7 + Math.sin(x * 0.007 - t * 2.6) * 10;
    ctx.beginPath(); ctx.moveTo(-40, bot + 60);
    for (let x = -40; x <= WORLD_W + 40; x += 16) ctx.lineTo(x, surf(x));
    ctx.lineTo(WORLD_W + 40, bot + 60); ctx.fill();
    ctx.strokeStyle = 'rgba(235,250,255,0.95)'; ctx.lineWidth = 5;
    ctx.beginPath(); for (let x = -40; x <= WORLD_W + 40; x += 16) x === -40 ? ctx.moveTo(x, surf(x)) : ctx.lineTo(x, surf(x)); ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const x = ((hash(k * 5) * 1600 - t * 50 * (1 + k * 0.2)) % 1600 + 1600) % 1600 - 200;
      ctx.save(); ctx.translate(x, surf(x) + 4); ctx.rotate(Math.sin(t * 2 + k) * 0.08);
      ctx.fillStyle = '#6b4526'; ctx.fillRect(-64, -9, 128, 18);
      ctx.fillStyle = '#4a2f3a'; ctx.fillRect(-64, 3, 128, 6);
      ctx.fillStyle = '#9a6a3c'; ctx.beginPath(); ctx.ellipse(64, 0, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (let k = 0; k < 16; k++) {
      const bx = hash(k) * WORLD_W;
      const by = wy + 30 + ((hash(k + 7) * 500 - t * 90 * (0.5 + hash(k + 9))) % 500 + 500) % 500;
      ctx.strokeStyle = 'rgba(220,245,255,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 4 + hash(k + 2) * 6, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function rope(w) {
    const m = w.m;
    ctx.lineCap = 'round';
    const seg = (x1, y1, x2, y2) => {
      const col = w.ropeColor || ['#2f5a24', '#7cb342'];
      ctx.strokeStyle = col[0]; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = col[1]; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    if (m.mode === 'hang' && m.anchor && m.anchor.kind !== 'vine') {
      const p = anchorPos(w, m.anchor);
      seg(p.x, p.y + (m.anchor.kind === 'bird' ? 26 : 0), m.x, m.y);
    }
    if (w.rope) {
      seg(m.x, m.y, w.rope.x, w.rope.y);
      ctx.fillStyle = '#d6f07a'; ctx.beginPath(); ctx.arc(w.rope.x, w.rope.y, 7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // サル: 原点 = 手 (ロープの先)。体は下にぶら下がる
  function monkeyBody(t, o) {
    const pose = o.mode === 'fly' ? 'fly' : o.mode === 'stand' ? 'stand' : o.mode === 'baby' ? 'baby' : 'hang';
    const mood = o.mood || (o.happy ? 'happy' : o.scared ? 'scared' : pose === 'fly' ? 'excited' : 'normal');
    drawMonkey(ctx, { pose, mood, t, hat: o.hat, wave: o.wave, arms: o.arms, legs: o.legs, look: o.look, ear: o.ear });
  }

  // サルの動き: 出来事のあとしばらくの「表情・手足・回転」を決める
  function monkey(w, t) {
    const m = w.m;
    const since = (k) => t - (R.last[k] ?? -99);
    let ang = 0;
    if (m.mode === 'hang' && m.anchor) {
      const p = anchorPos(w, m.anchor);
      ang = Math.atan2(m.x - p.x, m.y - p.y);
    } else if (m.mode === 'fly') ang = clamp(-m.vx / 1700, -0.8, 0.8) * -1;
    const nearWater = w.water - m.y < 260 && w.state === 'play';
    const sp = Math.hypot(m.vx, m.vy);
    const o = { mode: m.mode, hat: w.hat, look: [clamp(m.vx / 900, -1, 1), clamp(m.vy / 900, -1, 1)] };
    // 表情と手足
    if (w.state === 'clear') { o.happy = true; o.arms = 'cheer'; o.legs = 'tuck'; }
    else if (since('splash') < 1.2) { o.mood = 'hurt'; o.arms = 'flail'; o.legs = 'flail'; }
    else if (since('whiff') < 0.8) { o.mood = 'confused'; }
    else if (nearWater) { o.scared = true; }
    if (m.mode === 'hang' && !o.arms) {
      if (since('attach') < 0.35) { o.legs = 'tuck'; o.ear = 1; o.mood = o.mood || 'excited'; }
      else o.legs = 'dangle';
    } else if (m.mode === 'fly' && !o.arms) {
      if (m.vy > 450) { o.arms = 'flail'; o.legs = 'flail'; o.scared = true; }
      else { o.legs = 'tuck'; if (since('nice') < 0.6) o.arms = 'cheer'; }
    } else if (m.mode === 'stand') {
      o.legs = m.walking ? 'walk' : undefined;
      o.look = [Math.sin(t * 0.9) > 0 ? 0.9 : -0.9, -0.3];
      if (!m.walking && Math.sin(t * 0.7) > 0.8) o.arms = 'scratch';
    }
    ctx.save();
    // 地面: ぴょこぴょこ / ゴール: 小さく跳ねて踊る
    let bob = 0;
    if (m.mode === 'stand') bob = -Math.abs(Math.sin(t * (m.walking ? 12 : 3))) * (m.walking ? 6 : 3);
    if (w.state === 'clear') bob = -Math.abs(Math.sin(t * 8)) * 14;
    ctx.translate(m.x, m.y + bob);
    // 水が近いと震える
    if (nearWater && m.mode !== 'fly') ctx.translate(Math.sin(t * 60) * 1.5, 0);
    ctx.rotate(m.mode === 'hang' ? -ang : ang * 0.6);
    // 上手に離した時は宙返り (体の真ん中を中心に 1 回転)
    const ds = since('nice');
    if (m.mode === 'fly' && ds < 0.5) { ctx.translate(0, 50); ctx.rotate(-Math.sign(m.vx || 1) * (ds / 0.5) * Math.PI * 2); ctx.translate(0, -50); }
    if (w.state === 'clear') ctx.rotate(Math.sin(t * 8) * 0.18);
    // つぶれ・のび
    R.squash += (1 - R.squash) * 0.18;
    const st = m.mode === 'fly' ? clamp(sp / 2600, 0, 0.18) : 0;
    ctx.scale((1 - st * 0.5) * (2 - R.squash), (1 + st) * R.squash);
    // ふち光 (主役を一番明るく)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,120,0.10)';
    ctx.beginPath(); ctx.ellipse(0, 50, 46, 70, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    monkeyBody(t, o);
    if (w.baby) { ctx.save(); ctx.translate(-26, 52); ctx.scale(0.4, 0.4); monkeyBody(t, { mode: 'baby', wave: Math.sin(t * 8), happy: true }); ctx.restore(); }
    ctx.restore();
    // 頭の上: 空振りの「？」、水に落ちた後の目が回る星とずぶぬれのしずく
    if (since('whiff') < 0.8) txt('？', m.x + 34, m.y - 10 - since('whiff') * 20, 44, '#ffffff', '#3a1d2a');
    const dsp = since('splash');
    if (dsp < 1.2) {
      for (let k = 0; k < 3; k++) {
        const a = t * 7 + k * 2.1;
        ctx.fillStyle = '#ffe14d';
        star(m.x + Math.cos(a) * 30, m.y + 8 + Math.sin(a) * 9, 7);
      }
      for (let k = 0; k < 4; k++) {
        const u = ((dsp * 1.6 + k * 0.25) % 1);
        ctx.fillStyle = `rgba(160,220,255,${1 - u})`;
        ctx.beginPath(); ctx.ellipse(m.x - 20 + k * 13, m.y + 40 + u * 60, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 手を離した瞬間の輪
    const d = t - R.ringT;
    if (d >= 0 && d < 0.5) {
      ctx.strokeStyle = `rgba(255,214,64,${1 - d / 0.5})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(m.x, m.y + 40, 30 + d * 140, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function star(x, y, r) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 2; ctx.stroke(); ctx.fill();
  }

  function particlesDraw(w, dt) {
    const t = w.t;
    R.particles = R.particles.filter(p => t - p.t < p.life);
    for (const p of R.particles) {
      const d = t - p.t;
      const grav = p.shape === 'star' ? 0 : p.shape === 'conf' ? 500 : 1100;
      const x = p.x + p.vx * d, y = p.y + p.vy * d + 0.5 * grav * d * d;
      ctx.globalAlpha = 1 - d / p.life;
      ctx.fillStyle = p.c;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin * d);
      if (p.shape === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.4, p.r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (p.shape === 'conf' || p.shape === 'chip') ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
      else if (p.shape === 'star') { const r = p.r * (1.4 - d / p.life); ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, rr = k % 2 ? r * 0.4 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    R.texts = R.texts.filter(o => t - o.t < (o.life || 0.9));
    for (const o of R.texts) {
      const d = t - o.t, life = o.life || 0.9;
      const sc = d < 0.18 ? 0.6 + 0.4 * easeOutBack(d / 0.18) : 1;
      ctx.globalAlpha = clamp((life - d) / 0.3, 0, 1);
      ctx.save(); ctx.translate(o.x, o.y - d * 50); ctx.scale(sc, sc);
      txt(o.s, 0, 0, o.size, o.c, o.stroke || '#3a1f0a');
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function txt(s, x, y, size, fill, stroke, weight = '900') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = size * 0.24; ctx.strokeText(s, x, y); }
    ctx.fillStyle = fill; ctx.fillText(s, x, y);
  }
  R.txt = txt;

  // 狙いの線: 押した場所へ向かう細い線 (空中で、ロープが出ていない時だけ)
  function aimHint(w, t) {
    if (!R.hint) return;
    const h = R.hint;
    const d = t - h.t;
    if (d < 0 || d > 0.4) return;
    ctx.strokeStyle = h.miss ? `rgba(255,120,150,${1 - d / 0.4})` : `rgba(255,255,255,${1 - d / 0.4})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(h.x, h.y, 18 + d * 110, 0, Math.PI * 2); ctx.stroke();
  }

  function screenFx(w, t) {
    // 画面座標 (CSS px) で描く
    const cw = canvas.width / R.dpr, ch = canvas.height / R.dpr;
    const gap = w.water - (w.m.y + BODY);
    if (w.state === 'play' && gap < 230) {
      const k = clamp(1 - (gap - 40) / 190, 0, 1);
      const pulse = 0.6 + 0.4 * Math.sin(t * 16);
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
      g.addColorStop(0, 'rgba(255,0,60,0)'); g.addColorStop(1, `rgba(255,40,90,${0.42 * k * pulse})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
    // 水が画面の下にいる間は、近づくほど濃くなる青い帯で知らせる (予告)
    const below = w.water - (R.camY + R.viewH / 2);
    if (w.state === 'play' && below > 0 && below < 700) {
      const k = 1 - below / 700;
      const hh = 30 + k * 90;
      const g2 = ctx.createLinearGradient(0, ch - hh, 0, ch);
      g2.addColorStop(0, 'rgba(60,160,230,0)'); g2.addColorStop(1, `rgba(60,160,230,${0.25 + 0.5 * k})`);
      ctx.fillStyle = g2; ctx.fillRect(0, ch - hh, cw, hh);
      ctx.fillStyle = `rgba(220,245,255,${0.4 + 0.5 * k})`;
      for (let x = 0; x < cw; x += 60) { const yy = ch - 10 - Math.sin(t * 6 + x * 0.05) * 4; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 14, yy - 10 - k * 8); ctx.lineTo(x + 28, yy); ctx.fill(); }
    }
    if (R.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${R.flash})`; ctx.fillRect(0, 0, cw, ch); }
    // 速い時の風の線
    const sp = Math.hypot(w.m.vx, w.m.vy);
    if (sp > 1050 && w.state === 'play') {
      const a = clamp((sp - 1050) / 900, 0, 0.5);
      const ang = Math.atan2(w.m.vy, w.m.vx);
      ctx.save(); ctx.translate(cw / 2, ch / 2); ctx.rotate(ang);
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3;
      for (let k = 0; k < 18; k++) {
        const yy = (hash(k * 3 + Math.floor(t * 20)) - 0.5) * 1400, xx = (hash(k * 7 + Math.floor(t * 20)) - 0.5) * 1400;
        if (Math.abs(yy) < 110) continue;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 120 - hash(k) * 200, yy); ctx.stroke();
      }
      ctx.restore();
    }
  }

  R.draw = (w, dt, t) => {
    camera(w, dt);
    R.shake *= Math.pow(0.02, dt);
    R.flash = Math.max(0, R.flash - dt * 1.6);
    const s = R.scale * R.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const shx = (Math.random() - 0.5) * R.shake * 2, shy = (Math.random() - 0.5) * R.shake * 2;
    ctx.setTransform(s, 0, 0, s, shx * s, (R.viewH / 2 - R.camY + shy) * s);
    background(w, t);
    walls(t);
    leaves(w, t);
    anchors(w, t);
    fruits(w, t);
    ground(w);
    birds(w, t);
    rope(w);
    monkey(w, t);
    particlesDraw(w, dt);
    aimHint(w, t);
    water(w, t);
    foreground(t);
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    screenFx(w, t);
  };

  // サルの村: 助けた子ザルの数で家・ブランコ・やぐらが増える
  R.drawVillage = (count, t, hatKind) => {
    const cw = canvas.width / R.dpr, ch = canvas.height / R.dpr;
    const s = cw / WORLD_W;
    const H = ch / s;
    ctx.setTransform(s * R.dpr, 0, 0, s * R.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f6d98a'); g.addColorStop(0.55, '#9fcf7a'); g.addColorStop(1, '#3f7f4a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD_W, H);
    // 遠くの木
    for (let k = 0; k < 9; k++) {
      const x = k * 150 + 40;
      ctx.fillStyle = '#4c7d52'; ctx.fillRect(x - 14, H * 0.32, 28, H * 0.4);
      leafBlob(x, H * 0.3, 90, k + 300, 1);
    }
    const gy = H * 0.74;
    ctx.fillStyle = '#6b9a4a'; ctx.fillRect(0, gy, WORLD_W, H - gy);
    ctx.fillStyle = '#5a8a3e'; ctx.fillRect(0, gy, WORLD_W, 14);
    const spots = [[230, 'hut'], [500, 'swing'], [760, 'hut2'], [980, 'tower'], [380, 'pool']];
    for (let i = 0; i < 5; i++) {
      const [x, kind] = spots[i];
      if (i >= count) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 4;
        ctx.strokeRect(x - 70, gy - 140, 140, 140); ctx.setLineDash([]);
        txt('？', x, gy - 70, 60, 'rgba(255,255,255,0.6)', null);
        continue;
      }
      if (kind === 'hut' || kind === 'hut2') {
        ctx.fillStyle = '#a7743f'; ctx.fillRect(x - 60, gy - 100, 120, 100);
        ctx.fillStyle = '#7d5230'; ctx.fillRect(x - 60, gy - 100, 120, 14);
        ctx.fillStyle = kind === 'hut' ? '#d9b25a' : '#e0905a';
        ctx.beginPath(); ctx.moveTo(x - 82, gy - 96); ctx.lineTo(x, gy - 170); ctx.lineTo(x + 82, gy - 96); ctx.fill();
        ctx.fillStyle = '#4a2f3a'; ctx.beginPath(); roundRectPath(ctx, x - 18, gy - 56, 36, 56, 14); ctx.fill();
      } else if (kind === 'swing') {
        ctx.strokeStyle = '#7d5230'; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(x - 80, gy); ctx.lineTo(x - 60, gy - 180); ctx.lineTo(x + 60, gy - 180); ctx.lineTo(x + 80, gy); ctx.stroke();
        const a = Math.sin(t * 2.4) * 0.5;
        ctx.save(); ctx.translate(x, gy - 180); ctx.rotate(a);
        ctx.strokeStyle = '#3d7a34'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 110); ctx.stroke();
        ctx.fillStyle = '#7d5230'; ctx.fillRect(-26, 106, 52, 10);
        ctx.restore();
      } else if (kind === 'tower') {
        ctx.strokeStyle = '#7d5230'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(x - 50, gy); ctx.lineTo(x - 30, gy - 230); ctx.moveTo(x + 50, gy); ctx.lineTo(x + 30, gy - 230); ctx.stroke();
        ctx.fillStyle = '#a7743f'; ctx.fillRect(x - 60, gy - 250, 120, 24);
        ctx.fillStyle = '#ff6b5a'; ctx.beginPath(); ctx.moveTo(x, gy - 250); ctx.lineTo(x, gy - 320); ctx.lineTo(x + 50, gy - 300); ctx.lineTo(x, gy - 285); ctx.fill();
      } else if (kind === 'pool') {
        ctx.fillStyle = '#5ab8e8'; ctx.beginPath(); ctx.ellipse(x, gy + 40, 90, 26, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, gy + 40, 60, 14, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // 子ザルたち (人数分、跳ねる)
    for (let i = 0; i < count; i++) {
      const x = 160 + i * 190 + Math.sin(t * 0.8 + i) * 30, hop = Math.abs(Math.sin(t * 3 + i * 1.3)) * 30;
      ctx.save(); ctx.translate(x, gy - 50 - hop); ctx.scale(0.6, 0.6);
      monkeyBody(t + i, { mode: 'baby', wave: Math.sin(t * 6 + i) });
      ctx.restore();
    }
    // 主人公
    ctx.save(); ctx.translate(WORLD_W / 2 + 40, gy - 116); ctx.scale(0.95, 0.95);
    monkeyBody(t, { mode: 'stand', happy: true, hat: hatKind });
    ctx.restore();
  };

  // ホーム画面のアイコン (正方形の canvas に描く)
  R.drawIcon = (size) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#2f6a4a'); g.addColorStop(1, '#12302a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    const k = size / 240;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    leafBlob(120, 34, 70, 7, 1);
    ctx.strokeStyle = '#2f5a24'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(120, 40); ctx.lineTo(120, 92); ctx.stroke();
    ctx.strokeStyle = '#7cb342'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(120, 40); ctx.lineTo(120, 92); ctx.stroke();
    ctx.translate(120, 92); ctx.scale(1.25, 1.25);
    monkeyBody(0.3, { mode: 'hang', happy: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  // 画面座標 (CSS px) → 世界座標
  R.toWorld = (cx, cy) => ({ x: cx / R.scale, y: cy / R.scale - R.viewH / 2 + R.camY });

  return R;
}
