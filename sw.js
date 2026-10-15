// オフライン用: 最初に開いた時に全部のファイルを保存し、以後はネットがなくても開ける。
// 中身を直したら VERSION を上げる (古い保存を捨てて取り直す)
const VERSION = 'tsuta-202610152322';
const ASSETS = ['./', 'index.html', 'style.css', 'manifest.json', 'icon.png',
  'src/main.js', 'src/game.js', 'src/render.js', 'src/audio.js', 'src/autoplay.js', 'src/version.js',
  'src/art.js', 'src/voices.js',
  'assets/voice/b_help1.m4a', 'assets/voice/b_help2.m4a', 'assets/voice/b_saved1.m4a', 'assets/voice/b_saved2.m4a', 'assets/voice/m_bounce.m4a', 'assets/voice/m_clear.m4a', 'assets/voice/m_combo1.m4a', 'assets/voice/m_combo2.m4a', 'assets/voice/m_fail.m4a', 'assets/voice/m_fruit1.m4a', 'assets/voice/m_fruit2.m4a', 'assets/voice/m_grab1.m4a', 'assets/voice/m_grab2.m4a', 'assets/voice/m_grab3.m4a', 'assets/voice/m_hurt1.m4a', 'assets/voice/m_hurt2.m4a', 'assets/voice/m_jump1.m4a', 'assets/voice/m_jump2.m4a', 'assets/voice/m_jump3.m4a', 'assets/voice/m_kick1.m4a', 'assets/voice/m_kick2.m4a', 'assets/voice/m_loop.m4a', 'assets/voice/m_scared.m4a', 'assets/voice/m_whiff1.m4a', 'assets/voice/m_whiff2.m4a', 'assets/voice/t_carry1.m4a', 'assets/voice/t_carry2.m4a', 'assets/voice/t_drop.m4a', 'assets/voice/t_grab.m4a', 'assets/voice/t_tired.m4a',
  'assets/bgm-play.m4a', 'assets/bgm-home.m4a'];

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
