// つたのぼり: 効果音と音楽 (すべてその場で合成。毎回少しずつ高さを変える)
let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let musicOn = true, sfxOn = true, musicTimer = null, nextNote = 0, stepIdx = 0, tension = 0;

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.9 : 0; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.55 : 0; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.0, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  // 画面ロックや通知の後は 'interrupted' になる端末がある。どちらでも鳴らし直す
  if (ac.state === 'suspended' || ac.state === 'interrupted') ac.resume().catch(() => {});
  if (voiceIds.length) loadVoices(voiceIds);
}

export function setSound(music, sfx) {
  musicOn = music; sfxOn = sfx;
  if (musicBus) musicBus.gain.value = music ? 0.55 : 0;
  if (sfxBus) sfxBus.gain.value = sfx ? 0.9 : 0;
}

const vary = (f, cents = 60) => f * Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200);

function tone(freq, dur, { type = 'sine', gain = 0.3, attack = 0.004, at = 0, slideTo = null, bus = sfxBus } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(bus);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(dur, { freq = 1200, q = 0.8, gain = 0.3, at = 0, type = 'bandpass', slideTo = null, bus = sfxBus } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const src = ac.createBufferSource(); src.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
}

export const sfx = {
  fire() { noise(0.13, { freq: vary(1800), slideTo: 4200, q: 1.2, gain: 0.25 }); tone(vary(600), 0.08, { type: 'triangle', slideTo: 1300, gain: 0.08 }); },
  attach(combo, kind) {
    if (kind === 'bird') { for (let k = 0; k < 3; k++) tone(vary(2600, 120), 0.07, { at: k * 0.09, slideTo: 3600, gain: 0.1 }); return; }
    const f = vary(170 * Math.pow(1.06, Math.min(combo, 12)), 30);
    tone(f, 0.16, { type: 'triangle', gain: 0.35, slideTo: f * 0.7 });
    noise(0.12, { freq: 2500, q: 0.6, gain: 0.12 });
    if (combo >= 2) tone(vary(660 * Math.pow(2, Math.min(combo, 12) / 12), 15), 0.22, { type: 'sine', gain: 0.12, at: 0.02 });
  },
  release(nice) {
    tone(vary(320), 0.15, { type: 'sine', slideTo: 880, gain: 0.12 });
    if (nice) [1568, 2093, 2637].forEach((f, k) => tone(vary(f, 20), 0.22, { at: k * 0.045, gain: 0.07 }));
  },
  fruit(n) {
    const base = [988, 1109, 1175, 1319, 1480][n % 5];
    tone(vary(base, 15), 0.09, { type: 'square', gain: 0.05 });
    tone(vary(base * 1.5, 15), 0.24, { type: 'square', gain: 0.05, at: 0.07 });
  },
  whiff() { tone(vary(900), 0.45, { type: 'sine', slideTo: 170, gain: 0.12 }); noise(0.4, { freq: 900, slideTo: 300, gain: 0.12 }); },
  splash() { noise(0.7, { freq: 900, type: 'lowpass', gain: 0.5, slideTo: 300 }); tone(110, 0.3, { type: 'sine', gain: 0.35, slideTo: 60 }); },
  bounce() { tone(vary(220), 0.35, { type: 'sine', slideTo: 660, gain: 0.3 }); tone(vary(440), 0.25, { type: 'triangle', slideTo: 990, gain: 0.08, at: 0.03 }); },
  kick() { tone(vary(130), 0.12, { type: 'triangle', gain: 0.35, slideTo: 70 }); noise(0.08, { freq: 600, gain: 0.15 }); },
  bump() { tone(vary(100), 0.1, { type: 'triangle', gain: 0.2, slideTo: 60 }); },
  loop() { noise(0.6, { freq: 500, slideTo: 3000, q: 1.5, gain: 0.25 }); tone(vary(300), 0.5, { type: 'sawtooth', slideTo: 1200, gain: 0.04 }); },
  creak(level) { tone(vary(level === 1 ? 260 : 330, 80), 0.25, { type: 'sawtooth', gain: 0.05, slideTo: level === 1 ? 200 : 240 }); noise(0.18, { freq: 3000, q: 4, gain: 0.07 }); },
  break() { noise(0.25, { freq: 2200, q: 0.8, gain: 0.35 }); tone(vary(180), 0.2, { type: 'square', gain: 0.07, slideTo: 80 }); },
  baby() { [784, 988, 1175, 1568].forEach((f, k) => tone(f, 0.25, { at: k * 0.08, type: 'triangle', gain: 0.12 })); },
  birdTired() { tone(vary(1800), 0.25, { slideTo: 900, gain: 0.07 }); },
  land() { noise(0.15, { freq: 400, type: 'lowpass', gain: 0.25 }); },
  regrow() { tone(vary(500), 0.25, { type: 'sine', slideTo: 1000, gain: 0.08 }); },
  clear() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    const at = [0, 0.11, 0.22, 0.33, 0.52, 0.63, 0.78];
    notes.forEach((f, k) => { tone(f, k > 4 ? 0.9 : 0.2, { type: 'triangle', gain: 0.18, at: at[k] }); tone(f * 2, k > 4 ? 0.7 : 0.15, { type: 'sine', gain: 0.05, at: at[k] }); });
  },
  fail() { [392, 349, 311, 262].forEach((f, k) => tone(f, 0.35, { type: 'triangle', gain: 0.15, at: k * 0.2 })); },
  star(k) { tone(880 * Math.pow(1.26, k), 0.3, { type: 'triangle', gain: 0.18 }); tone(1760 * Math.pow(1.26, k), 0.3, { gain: 0.06 }); },
  tap() { tone(vary(700, 30), 0.06, { type: 'triangle', gain: 0.12 }); },
  alarm() { tone(880, 0.09, { type: 'square', gain: 0.06 }); tone(660, 0.09, { type: 'square', gain: 0.05, at: 0.11 }); },
};

// ---- 音楽: 太鼓とマリンバ。水が近いと低い音が加わる ----
const SCALE = [392, 440, 523, 587, 659, 784, 880, 1047];
const MELODY = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 5, 7, 5, 4, 2, 3, 4, 2, 0, 1, 2, 4, 2, 5, 4, 5, 6, 7, 6, 4, 2];
const BASS = [196, 196, 220, 174.6];

export function setTension(k) { tension = k; }

function scheduleStep(t) {
  const pos = stepIdx % 16;
  const b = musicBus;
  const at = t - ac.currentTime;
  if (pos === 0 || pos === 8 || (pos === 11 && stepIdx % 32 > 16)) tone(110, 0.22, { type: 'sine', slideTo: 45, gain: 0.55, at, bus: b });
  if (pos === 4 || pos === 12) noise(0.12, { freq: 1800, q: 0.7, gain: 0.18, at, bus: b });
  if (pos === 3 || pos === 6 || pos === 14) tone(240, 0.16, { type: 'sine', slideTo: 170, gain: 0.25, at, bus: b });
  noise(0.04, { freq: 7000, q: 1, gain: pos % 2 ? 0.04 : 0.07, at, bus: b, type: 'highpass' });
  if (pos % 2 === 0) {
    const n = MELODY[(stepIdx / 2) % MELODY.length | 0];
    tone(SCALE[n], 0.28, { type: 'triangle', gain: 0.13, at, bus: b });
    tone(SCALE[n] * 2, 0.12, { type: 'sine', gain: 0.03, at, bus: b });
  }
  if (pos % 8 === 0) tone(BASS[(stepIdx / 8 | 0) % 4] / 2, 0.9, { type: 'triangle', gain: 0.22, at, bus: b });
  if (tension > 0.3 && pos % 4 === 0) tone(146.8, 0.3, { type: 'sawtooth', gain: 0.05 * tension, at, bus: b });
}

// ---- 動物の声 (Gemini で声優として演技させた声)。同じ場面でも毎回少し違う声・高さにする ----
const VOICE_GROUPS = {
  jump: ['m_jump1', 'm_jump2', 'm_jump3'], grab: ['m_grab1', 'm_grab2', 'm_grab3'], combo: ['m_combo1', 'm_combo2'],
  loop: ['m_loop'], kick: ['m_kick1', 'm_kick2'], whiff: ['m_whiff1', 'm_whiff2'], hurt: ['m_hurt1', 'm_hurt2'],
  fail: ['m_fail'], clear: ['m_clear'], bounce: ['m_bounce'], scared: ['m_scared'], fruit: ['m_fruit1', 'm_fruit2'],
  help: ['b_help1', 'b_help2'], saved: ['b_saved1', 'b_saved2'],
  tgrab: ['t_grab'], tcarry: ['t_carry1', 't_carry2'], ttired: ['t_tired'], tdrop: ['t_drop'],
};
// 大事な声 (痛い・クリア等) は鳴っている声を止めて割り込む。ふだんの声は間をあける
const URGENT = new Set(['hurt', 'fail', 'clear', 'saved', 'loop', 'combo', 'tdrop', 'ttired']);
const voiceBufs = {};
const speaking = {};
let voiceIds = [];

export function loadVoices(ids) {
  voiceIds = ids;
  if (!ac) return;
  for (const id of ids) {
    if (voiceBufs[id]) continue;
    voiceBufs[id] = 'loading';
    fetch(`assets/voice/${id}.m4a`).then((r) => r.arrayBuffer())
      .then((ab) => new Promise((ok, ng) => ac.decodeAudioData(ab, ok, ng)))
      .then((buf) => { voiceBufs[id] = buf; })
      .catch(() => { delete voiceBufs[id]; });
  }
}

export function voice(group, gain = 1) {
  if (!ac || !sfxOn) return;
  const who = group.startsWith('t') ? 'toucan' : (group === 'help' || group === 'saved') ? 'baby' : 'monkey';
  const now = ac.currentTime;
  const cur = speaking[who];
  if (cur && now < cur.end) {
    if (!URGENT.has(group)) return;
    try { cur.src.stop(); } catch { /* 止まっている */ }
  }
  const ids = (VOICE_GROUPS[group] || []).filter((id) => voiceBufs[id] && voiceBufs[id] !== 'loading');
  if (!ids.length) return;
  const buf = voiceBufs[ids[Math.floor(Math.random() * ids.length)]];
  const src = ac.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = vary(1, 45);
  const g = ac.createGain(); g.gain.value = 1.1 * gain;
  src.connect(g); g.connect(sfxBus);
  src.start(now);
  speaking[who] = { src, end: now + buf.duration / src.playbackRate.value };
}

// ---- 曲 (Gemini の Lyria で作ったもの) をつなぎ目なく繰り返す。読めない時は合成の曲 ----
const LOOP_HEAD = 0.1;
const LOOPS = { play: 'assets/bgm-play.m4a', home: 'assets/bgm-home.m4a' };
const buffers = {};
let curName = null, curSrc = null, curGain = null, wantName = null;

function loadTrack(name) {
  if (!buffers[name]) {
    buffers[name] = fetch(LOOPS[name])
      .then((r) => { if (!r.ok) throw new Error('bgm ' + r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((ok, ng) => ac.decodeAudioData(ab, ok, ng)))
      .catch((e) => { buffers[name] = null; throw e; });
  }
  return buffers[name];
}

export function startMusic(name = 'home') {
  if (!ac) return;
  wantName = name;
  if (curName === name) return;
  loadTrack(name).then((buf) => {
    if (wantName !== name || curName === name) return;
    const t = ac.currentTime;
    if (curSrc) { const g = curGain, s0 = curSrc; g.gain.setTargetAtTime(0, t, 0.25); setTimeout(() => { try { s0.stop(); } catch { /* 止まっている */ } }, 1500); }
    stopSynth();
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    src.loopStart = LOOP_HEAD; src.loopEnd = buf.duration - 0.6 + LOOP_HEAD;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(name === 'play' ? 0.95 : 0.8, t + 0.8);
    src.connect(g); g.connect(musicBus);
    src.start(t, LOOP_HEAD);
    curSrc = src; curGain = g; curName = name;
  }).catch(() => { if (wantName === name && !curSrc) startSynth(); });
}

function startSynth() {
  if (!ac || musicTimer) return;
  const stepDur = 60 / 118 / 4;
  nextNote = ac.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (nextNote < ac.currentTime + 0.15) { scheduleStep(nextNote); nextNote += stepDur; stepIdx++; }
  }, 30);
}

function stopSynth() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
export function stopMusic() { stopSynth(); }
