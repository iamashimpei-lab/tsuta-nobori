# つたのぼり

サルがロープを枝にかけて振り子のように揺れ、水が来る前にジャングルのてっぺんまで登るゲーム。iPad 向け (横・縦どちらも)。

- 遊ぶ: https://iamashimpei-lab.github.io/tsuta-nobori/ (Safari で開いて「ホーム画面に追加」すると、次からネットなしでも開ける)
- 操作: 押したまま = ぶら下がって漕ぐ / 離す = 飛ぶ / 飛んでいる間に枝を押す = ロープ
- 絵と音はすべてプログラムで描いて合成している (外部の素材なし)

## 開発

- 開発用サーバー: `python3 tools/dev-server.py` → http://127.0.0.1:8650/ (キャッシュ無効)
- 自動プレイで各面を何百回も試す: `node tools/bot.mjs 263 0.10` (2 つ目の数字が大きいほど下手)
- 画面の検品写真: `python3 tools/qa.py` → `tools/out/`
- 自動プレイの様子をブラウザで見る: `?auto=面番号&seed=数字`
- 公開: main に push すると GitHub Pages に 1 分ほどで反映。中身を変えたら `sw.js` の `VERSION` を上げる

企画と作り方の記録 = [docs/game-design.md](docs/game-design.md)
