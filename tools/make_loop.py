"""録った曲から、つなぎ目の分からないループを作る。

usage: python3 tools/make_loop.py <名前> <bpm> <小節数>
出力: assets/bgm-<名前>.m4a。ゲームは loopStart=0.1 秒 / loopEnd=本体+0.1 秒 で繰り返す
(最後の 1 秒で頭へ溶かし込み、本体の後ろに頭の続きを 0.6 秒付けてある)。
"""
from __future__ import annotations

import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
SR = 48000


def main() -> None:
    name, bpm, bars = sys.argv[1], float(sys.argv[2]), int(sys.argv[3])
    with wave.open(str(HERE / "out" / f"{name}_raw.wav")) as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2).astype(np.float32)
    start = int(2.0 * SR)
    body = int(round(bars * 4 * 60 / bpm * SR))
    tail = int(0.6 * SR)
    xf = int(1.0 * SR)
    need = start + body + tail
    if len(raw) < need:
        raise SystemExit(f"録音が短い: {len(raw) / SR:.1f}s < {need / SR:.1f}s")
    seg = raw[start:start + body + tail].copy()
    head = raw[start:start + tail + xf]
    # 本体の最後 xf を、頭 (本体の直前の位置から見た続き) へ溶かす
    fade = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
    seg[body - xf:body] = seg[body - xf:body] * (1 - fade) + raw[start - xf:start] * fade if start >= xf else seg[body - xf:body]
    seg[body:body + tail] = head[:tail]
    peak = np.abs(seg).max()
    seg = seg / peak * 32767 * 0.89
    tmp = HERE / "out" / f"{name}_loop.wav"
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(seg.astype(np.int16).tobytes())
    out = HERE.parent / "assets" / f"bgm-{name}.m4a"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(tmp), "-c:a", "aac", "-b:a", "128k", str(out)], check=True)
    print(f"{out.name}: 本体 {body / SR:.2f}s (+{tail / SR:.1f}s)  {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
