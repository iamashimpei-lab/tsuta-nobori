// 自動プレイの頭脳: 本物の入力 (press / lift) だけで遊ぶ。node の大量テストと、ブラウザのデモの両方で使う
import { createWorld, step, press, lift, anchorPos, grabPoint, grabbable, stars, STAGES, DT, G, ROPE_RANGE, BODY, FOREST_W, AIR_DRAG } from './game.js';

const hyp = Math.hypot;
let FRUIT_SEEK = false;
export function setFruitSeek(v) { FRUIT_SEEK = v; }

export function gauss(R) { return Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R()); }
export function mulberry(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ぶら下がりの動きだけを軽く先読みする (押しっぱなし前提)
function simulateHang(w, m0, a, steps) {
  const m = { ...m0 };
  const out = [];
  let t = w.t;
  for (let i = 0; i < steps; i++) {
    t += DT;
    const p = anchorPos(w, a, t);
    m.vy += G * DT;
    const f = Math.atan2(m.x - p.x, m.y - p.y);
    if (Math.abs(f) < 0.65 && a.kind !== 'bird') {
      const dx = m.x - p.x, dy = m.y - p.y, r = hyp(dx, dy) || 1;
      const sgn = Math.sign(dy * (m.vx - p.vx) - dx * (m.vy - p.vy)) || 1;
      m.vx += sgn * (dy / r) * 1500 * DT; m.vy += sgn * (-dx / r) * 1500 * DT;
    }
    m.x += m.vx * DT; m.y += m.vy * DT;
    if (m.L > m.Lmin) { const nl = Math.max(m.Lmin, m.L - 60 * DT); m.vx *= m.L / nl; m.vy *= m.L / nl; m.L = nl; }
    const dx = m.x - p.x, dy = m.y - p.y, r = hyp(dx, dy);
    if (r > m.L) {
      const nx = dx / r, ny = dy / r;
      m.x = p.x + nx * m.L; m.y = p.y + ny * m.L;
      const wr = (m.vx - p.vx) * nx + (m.vy - p.vy) * ny;
      if (wr > 0) { m.vx -= wr * nx; m.vy -= wr * ny; }
    }
    if (m.x < -200 || m.x > FOREST_W + 200) break;
    out.push({ i: i + 1, t, x: m.x, y: m.y, vx: m.vx, vy: m.vy });
  }
  return out;
}

// 手を離した後の飛び方から、届く一番高い枝を探す
function bestFrom(w, s, excl, minGainY) {
  let best = null;
  for (let tau = 0.06; tau <= 1.1; tau += 0.04) {
    const x = s.x + s.vx * (1 - Math.exp(-AIR_DRAG * tau)) / AIR_DRAG, y = s.y + s.vy * tau + 0.5 * G * tau * tau;
    if (x < -200 || x > FOREST_W + 200) break;
    if (y + BODY > w.water - (w.stage.water * (s.t - w.t + tau)) - 40) break;
    for (const a of w.anchors) {
      if (a === excl) continue;
      const t = s.t + tau;
      if (a.kind === 'thin' && a.broken) continue;
      if (a.kind === 'bird' && !(a.mode === 'free' && t >= (a.restUntil || 0))) continue;
      const gp = grabPoint(w, a, t);
      const d = hyp(gp.x - x, gp.y - y);
      if (d > ROPE_RANGE * 0.88 || d < 60) continue;
      if (gp.y > minGainY) continue;
      // 枝の真下〜少し横でつかむと、その後よく振れる
      const lateral = Math.abs(gp.x - x) / d;
      let fb = 0;
      if (FRUIT_SEEK) for (const f of w.fruits) { if (f.got) continue; for (let u = 0.04; u <= tau; u += 0.04) { const fx = s.x + s.vx * u, fy = s.y + s.vy * u + 0.5 * G * u * u + BODY * 0.6; if (hyp(f.x - fx, f.y - fy) < 60) { fb += 220; break; } } }
      const score = fb + -gp.y + (a.kind === 'bird' || a.kind === 'vine' ? 260 : 0) + (a.baby && !w.baby ? 180 : 0) - lateral * 30 - tau * 40;
      if (!best || score > best.score) best = { a, tau, x, y, score, gp };
    }
  }
  return best;
}

export function createBot(seed, jitter = 0.06) {
  const R = mulberry(seed);
  const st = { plan: null, holdUntilT: 0, failsAt: [], started: false, hb: 0 };
  return {
    st,
    // step の直前に呼ぶ
    tick(w) {
      if (!st.started) { st.started = true; press(w, w.m.x, w.m.y - 100); }
      const m = w.m;
      if (m.mode === 'hang' && !st.plan && w.t > st.holdUntilT) {
        const cur = m.anchor;
        const curY = anchorPos(w, cur).y;
        const traj = simulateHang(w, { x: m.x, y: m.y, vx: m.vx, vy: m.vy, L: m.L, Lmin: m.Lmin }, cur, 300);
        let best = null;
        for (let k = 0; k < traj.length; k += 3) {
          const s = traj[k];
          const b = bestFrom(w, s, cur, Math.min(curY - 70, m.y - 120));
          if (b && (!best || b.score - k * 0.4 > best.score - best.k * 0.4)) best = { ...b, k, s };
        }
        if (best) {
          const jr = gauss(R) * jitter, jp = gauss(R) * jitter;
          st.plan = { releaseAt: best.s.t + jr, pressAt: best.s.t + best.tau - 0.09 + jp, target: best.a, aim: best.gp, aimErr: [gauss(R) * 25, gauss(R) * 25] };
        } else st.holdUntilT = w.t + 0.25;
      }
      if (st.plan && m.mode === 'hang' && w.t >= st.plan.releaseAt) lift(w);
      if (st.plan && m.mode === 'fly' && !w.rope && w.t >= st.plan.pressAt) {
        const gp = grabPoint(w, st.plan.target);
        press(w, gp.x + st.plan.aimErr[0], gp.y + st.plan.aimErr[1]);
        st.plan = null;
      }
      // 空中で予定がない (空振り・葉で跳ねた・鳥が落とした): 届く枝へ急いでつかむ
      if (!st.plan && m.mode === 'fly' && !w.rope) {
        const b = bestFrom(w, { t: w.t, x: m.x, y: m.y, vx: m.vx, vy: m.vy }, null, m.vy < -300 ? m.y - 200 : 1e9);
        if (b && b.tau < 0.12) { press(w, b.gp.x, b.gp.y); }
        else if (!b && m.vy > 400) {
          // 何でもいいので一番近い枝
          let near = null, nd = 1e9;
          for (const a of w.anchors) { if (!grabbable(w, a)) continue; const g = grabPoint(w, a); const d = hyp(g.x - m.x, g.y - m.y); if (d < ROPE_RANGE * 0.9 && d < nd) { nd = d; near = g; } }
          if (near) press(w, near.x, near.y);
        }
      }
      if (m.mode === 'hang' && !w.holding && w.state === 'play') { press(w, m.x, m.y - 50); }
      if (m.mode === 'stand' && !w.rope && w.t > (w._standWait || 0)) {
        if (w.holding) lift(w);
        const b = bestFrom(w, { t: w.t, x: m.x, y: m.y, vx: 0, vy: 0 }, null, 1e9);
        let near = null, nd = 1e9;
        for (const a of w.anchors) { if (!grabbable(w, a)) continue; const g = grabPoint(w, a); const d = hyp(g.x - m.x, g.y - m.y); if (d < ROPE_RANGE * 0.9 && d < nd) { nd = d; near = g; } }
        if (near) press(w, near.x + gauss(R) * 25, near.y + gauss(R) * 25);
        w._standWait = w.t + 0.6 + R() * 0.6;
      }
      st.hb = w.hearts;
    },
    // step の直後に呼ぶ
    after(w) {
      const hb = st.hb;
      if (w.hearts < hb) {
        st.failsAt.push(Math.round(-w.m.y / 40)); st.plan = null;
        if (typeof process !== 'undefined' && process.env && process.env.BOT_DEBUG) {
          const recent = w.events.filter(e => e.t > w.t - 3 && e.type !== 'fruit').map(e => `${e.t.toFixed(1)}:${e.type}${e.kind ? '/' + e.kind : ''}${e.x != null ? '@' + Math.round(e.x) + ',' + Math.round(e.y) : ''}`);
          console.log('SPLASH h=' + Math.round(-w.m.y / 40), recent.join(' '));
        }
      }
      if (w.m.mode === 'hang' && st.plan && st.plan.target !== w.m.anchor && w.t > st.plan.pressAt + 0.3) st.plan = null;
    },
  };
}
