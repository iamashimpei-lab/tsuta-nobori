// くだもの 1 つずつの取れた割合 (取れないくだものを探す)
import { playOnce } from './bot.mjs';
import { createWorld, STAGES } from '../src/game.js';
import * as G from '../src/game.js';
const runs = Number(process.argv[2] || 40);
for (let si = 0; si < STAGES.length; si++) {
  const got = new Array(createWorld(si).fruits.length).fill(0);
  for (let k = 0; k < runs; k++) {
    const r = playOnce(si, 5000 + k, 0.05, 150, true);
    r.fruitFlags.forEach((f, i) => { if (f) got[i]++; });
  }
  console.log(STAGES[si].id, got.map(g => Math.round(100 * g / runs) + '%').join(' '));
}
