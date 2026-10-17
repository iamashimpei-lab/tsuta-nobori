# HANDOFF — つたのぼり

**Status (2026-10-17)**: ワールド 1〜3 (各 5 面、計 15 面)・サルの村・おみせ・オフライン対応。子ども相当クリア率はワールド 2 が 98/92/93/86/93%、ワールド 3 が 96/95/96/99/94%。絵を作り込み、声は本物の動物の録音 (サル・オオハシ・ゾウ・フクロウ)、曲は熱帯雨林風 (候補 C)。試聴ページ `voice-test.html`。自動プレイで各面 263 回の検証済み。公開先 https://iamashimpei-lab.github.io/tsuta-nobori/ (GitHub Pages、main へ push で反映)。

## Next up

1. **子どもに遊んでもらう** (作り方の 8 番目「面白さは人が決める」)。見ること: 説明なしで遊べるか / 「もう 1 回」と言うか / どこで投げ出すか / 横と縦どちらで持つか
2. その感想で 1-1 の手引きと難しさを直す
3. ワールド 4 (滝の谷) は本人の依頼待ち

## Documentation index

| 内容 | ファイル |
| --- | --- |
| 企画・決めたこと・自動プレイで直した詰まり | docs/game-design.md |
| 開発の手順 | README.md |

## Key operational notes

- 森に左右の壁はない (2026-10-16 本人指摘で撤去)。横の広さは `FOREST_W`、空中の横の弱まりは `AIR_DRAG`。壁で弾き返す仕組みを戻さない
- 物理とルール (`src/game.js`) は描画と音を持たない。node の自動プレイ (`tools/bot.mjs`) とブラウザで同じものが動く。仕様を変えたら必ず `node tools/bot.mjs 263 0.10` と `0.14` (子ども相当) を回す
- 見た目の確認は `python3 tools/dev-server.py` + `python3 tools/qa.py` (Playwright の画面写真)。見た目のバグはテストを通り抜けるので、写真を必ず見る
- 公開の直前に `python3 tools/stamp.py` を呼ぶ。ホーム画面の一番下の「last update」の時刻と `sw.js` の `VERSION` が更新される (上げないと iPad に古い版が残る)
- 曲は Gemini の Lyria RealTime で作る: `python3 tools/gen_bgm.py play 110` → `python3 tools/make_loop.py play 124 48` (つなぎ目のないループを `assets/` へ)
- 遊んでいる時の曲は `jungle_c` (2026-10-16 本人が B/C/D から選んだ。熱帯雨林の打楽器と言葉のない詠唱): `gen_bgm.py jungle_c 110` → `make_loop.py jungle_c 104 40` → `assets/bgm-play.m4a` へ写す
- 動物の声は本物の録音から作る: `python3 tools/fetch_animal_sounds.py` → `python3 tools/make_voices.py` (切り出し位置と高さは `RECIPES`)。言葉を話す声は入れない (2026-10-15 本人指摘「ドンキーコングが人間の声で喋るか」)。`gen_voices.py` / `check_voices.py` は旧方式で使わない
- 描画中のエラーでループが止まらないよう try/catch してある。最後のエラーはホーム画面の一番下に出る (iPad でしか起きない不具合の手がかり)
- gitleaks が `SAVE_KEY` を誤検知するので `// gitleaks:allow` を付けてある
