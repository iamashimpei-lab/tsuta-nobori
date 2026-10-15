// 自動プレイ: 何百回も試して、どの高さで水に落ちるか (みんなが詰まる場所) を数える
// 使い方: node tools/bot.mjs [回数=300] [ぶれ秒=0.06] [面番号]
import { createWorld, step, stars, STAGES } from '../src/game.js';
import { createBot, setFruitSeek } from '../src/autoplay.js';

setFruitSeek(!!process.env.FRUIT_SEEK);

export function playOnce(stageIndex, seed, jitter = 0.06, maxT = 150) {
  const w = createWorld(stageIndex);
  const bot = createBot(seed, jitter);
  while (w.state === 'play' && w.t < maxT) {
    bot.tick(w);
    step(w);
    bot.after(w);
  }
  const failsAt = bot.st.failsAt;
  const kinds = {}; for (const e of w.events) if (e.type === 'attach' || e.type === 'kick' || e.type === 'bounce') { const k = e.type === 'attach' ? e.kind : e.type; kinds[k] = (kinds[k] || 0) + 1; }
  return { fruitFlags: w.fruits.map(f => f.got), kinds, state: w.state, t: w.t, height: w.height, total: Math.round(-w.goalY / 40), fruits: w.fruitsGot, fruitsAll: w.fruits.length, whiffs: w.whiffs, baby: w.baby, hearts: w.hearts, failsAt, maxCombo: w.maxCombo, stars: stars(w) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runs = Number(process.argv[2] || 300);
  const jitter = Number(process.argv[3] || 0.06);
  const only = process.argv[4] != null ? Number(process.argv[4]) : null;
  for (let si = 0; si < STAGES.length; si++) {
    if (only != null && si !== only) continue;
    const res = [];
    for (let k = 0; k < runs; k++) res.push(playOnce(si, 1000 + k, jitter));
    const clear = res.filter(r => r.state === 'clear');
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const fails = res.flatMap(r => r.failsAt);
    const hist = {};
    for (const h of fails) { const b = Math.floor(h / 10) * 10; hist[b] = (hist[b] || 0) + 1; }
    const timeouts = res.filter(r => r.state === 'play').length;
    console.log(`${STAGES[si].id} ${STAGES[si].name}: クリア ${clear.length}/${runs} (${Math.round(100 * clear.length / runs)}%)  時間中央 ${med(clear.map(r => r.t))?.toFixed(1)}s  高さ ${res[0].total}m  時間切れ ${timeouts}`);
    console.log(`   ★2(くだもの全部) ${clear.filter(r => r.stars[1]).length}  ★3(空振りなし) ${clear.filter(r => r.stars[2]).length}  子ザル ${res.filter(r => r.baby).length}  水に落ちた高さ(10m刻み) ${JSON.stringify(hist)}  最大れんぞく中央 ${med(res.map(r => r.maxCombo))}`);
    const kt = {}; for (const r of res) for (const [k, v] of Object.entries(r.kinds)) kt[k] = (kt[k] || 0) + v;
    console.log('   1回あたり', Object.fromEntries(Object.entries(kt).map(([k, v]) => [k, +(v / runs).toFixed(1)])));
    if (timeouts) console.log('   時間切れの高さ', res.filter(r => r.state === 'play').slice(0, 8).map(r => r.height));
  }
}
