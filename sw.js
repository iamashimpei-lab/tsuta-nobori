// オフライン用: 最初に開いた時に全部のファイルを保存し、以後はネットがなくても開ける。
// 中身を直したら VERSION を上げる (古い保存を捨てて取り直す)
const VERSION = 'tsuta-v2';
const ASSETS = ['./', 'index.html', 'style.css', 'manifest.json', 'icon.png',
  'src/main.js', 'src/game.js', 'src/render.js', 'src/audio.js', 'src/autoplay.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// ネットにつながる時は新しい物を取り、つながらない時は保存した物を使う
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      // 正常な応答だけ保存する (エラーの応答で正しい保存を上書きしない)
      if (res.ok) {
        const copy = res.clone();
        e.waitUntil(caches.open(VERSION).then((c) => c.put(e.request, copy)));
        return res;
      }
      return (await caches.match(e.request, { ignoreSearch: true })) || res;
    } catch {
      return caches.match(e.request, { ignoreSearch: true });
    }
  })());
});
