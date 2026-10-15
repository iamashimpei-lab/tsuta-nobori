"""録った声を仕上げる: 前後の無音を切る → 高さを上げてアニメらしく → 音量をそろえる → assets/voice/<id>.m4a。
src/voices.js (声の一覧) も書く。使えない声は SKIP に入れて外す。"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
VO = HERE / "out" / "voices"
ASSET = HERE.parent / "assets" / "voice"
PITCH = {"m": 1.22, "b": 1.4, "t": 1.08}
SKIP: set[str] = set()


def main() -> None:
    tr = json.loads((VO / "transcript.json").read_text())
    ASSET.mkdir(parents=True, exist_ok=True)
    ids = []
    for cid in sorted(tr):
        if cid in SKIP:
            continue
        a = np.frombuffer((VO / f"{cid}.pcm").read_bytes(), dtype=np.int16).astype(np.float32)
        if len(a) < 2400:
            print(f"{cid}: 短すぎるので外す"); continue
        env = np.convolve(np.abs(a), np.ones(240) / 240, mode="same")
        on = np.where(env > 600)[0]
        if not len(on):
            print(f"{cid}: 声が無いので外す"); continue
        a = a[max(0, on[0] - 600):on[-1] + 2400]
        k = PITCH[cid[0]]
        x = np.arange(0, len(a) - 1, k)
        a = np.interp(x, np.arange(len(a)), a)
        fade = min(len(a) // 4, 600)
        a[-fade:] *= np.linspace(1, 0, fade)
        a = a / (np.abs(a).max() + 1) * 32767 * 0.9
        tmp = VO / f"{cid}_fx.wav"
        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes(a.astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(tmp), "-ar", "44100", "-c:a", "aac", "-b:a", "64k", str(ASSET / f"{cid}.m4a")], check=True)
        ids.append(cid)
        print(f"{cid}: {len(a) / 24000:.2f}s")
    (HERE.parent / "src" / "voices.js").write_text("// tools/make_voices.py が書く。手で直さない\nexport const VOICE_IDS = " + json.dumps(ids) + ";\n")


if __name__ == "__main__":
    main()
