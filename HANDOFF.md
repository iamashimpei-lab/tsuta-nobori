# HANDOFF — つたのぼり

**Status (2026-10-15)**: 第 1 便 = ワールド 1 (5 面)・サルの村・おみせ・オフライン対応。自動プレイで各面 263 回の検証済み。公開先 https://iamashimpei-lab.github.io/tsuta-nobori/ (GitHub Pages、main へ push で反映)。

## Next up

1. **子どもに遊んでもらう** (作り方の 8 番目「面白さは人が決める」)。見ること: 説明なしで遊べるか / 「もう 1 回」と言うか / どこで投げ出すか / 横と縦どちらで持つか
2. その感想で 1-1 の手引きと難しさを直す
3. ワールド 2 (動物の森: キリン・ゾウ・ナマケモノ・ハチの巣)

## Documentation index

| 内容 | ファイル |
| --- | --- |
| 企画・決めたこと・自動プレイで直した詰まり | docs/game-design.md |
| 開発の手順 | README.md |

## Key operational notes

- 物理とルール (`src/game.js`) は描画と音を持たない。node の自動プレイ (`tools/bot.mjs`) とブラウザで同じものが動く。仕様を変えたら必ず `node tools/bot.mjs 263 0.10` と `0.14` (子ども相当) を回す
- 見た目の確認は `python3 tools/dev-server.py` + `python3 tools/qa.py` (Playwright の画面写真)。見た目のバグはテストを通り抜けるので、写真を必ず見る
- 中身を変えて公開する時は `sw.js` の `VERSION` を上げる (上げないと iPad に古い版が残る)
- gitleaks が `SAVE_KEY` を誤検知するので `// gitleaks:allow` を付けてある
