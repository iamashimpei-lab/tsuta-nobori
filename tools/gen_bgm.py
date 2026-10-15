"""Gemini の Lyria RealTime でゲームの BGM を録る (無料枠で使える実験版)。

usage: python3 tools/gen_bgm.py <名前> <秒数>   出力: tools/out/<名前>_raw.wav (48kHz ステレオ)
鍵は 2nd-brain-project/.env の GEMINI_API_KEY を読む (このリポジトリには置かない)。
"""
from __future__ import annotations

import base64
import sys
import time
import wave
from pathlib import Path

sys.path.insert(0, "/Users/shimpeiyamakawa/projects/2nd-brain-project/scripts/voice-conversation")
from verify_live import WebSocket  # noqa: E402

OUT = Path(__file__).parent / "out"
ENV = Path("/Users/shimpeiyamakawa/projects/2nd-brain-project/.env")
PATH = "/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic?key="
BPS = 48000 * 2 * 2
TRACKS: dict[str, tuple[str, int, float, float]] = {
    # 名前: (プロンプト, bpm, density, brightness)
    "play": ("Upbeat jungle adventure video game music for kids, energetic tribal hand drums, djembe and congas, "
             "shakers, playful marimba and kalimba melody, bouncy wooden flute riffs, monkeys swinging through vines, "
             "fun, bright, exciting chase, tropical rainforest", 124, 0.68, 0.62),
    "home": ("Cheerful relaxed jungle village theme for a kids video game, warm marimba and kalimba melody, "
             "soft bongos and shakers, gentle ukulele, birdsong feeling, sunny tropical rainforest, happy and cozy", 100, 0.45, 0.6),
}


def load_key() -> str:
    for line in ENV.read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("GEMINI_API_KEY not found")


def record(key: str, name: str, pcm: bytearray, total: float) -> None:
    prompt, bpm, density, brightness = TRACKS[name]
    ws = WebSocket("generativelanguage.googleapis.com", PATH + key, 60)
    try:
        ws.send_json({"setup": {"model": "models/lyria-realtime-exp"}})
        ws.receive_json()
        ws.send_json({"clientContent": {"weightedPrompts": [{"text": prompt, "weight": 1.0}]}})
        ws.send_json({"musicGenerationConfig": {"bpm": bpm, "temperature": 1.0, "guidance": 4.0,
                                                "density": density, "brightness": brightness}})
        ws.send_json({"playbackControl": "PLAY"})
        deadline = time.time() + 600
        while len(pcm) < total * BPS and time.time() < deadline:
            for c in ws.receive_json().get("serverContent", {}).get("audioChunks", []):
                pcm.extend(base64.b64decode(c["data"]))
    finally:
        ws.close()


def main() -> None:
    name, total = sys.argv[1], float(sys.argv[2])
    key = load_key()
    pcm = bytearray()
    for _ in range(4):
        try:
            record(key, name, pcm, total)
        except Exception as e:  # noqa: BLE001 - 接続断は続きから録り直す
            print(f"drop at {len(pcm) / BPS:.1f}s: {type(e).__name__} {str(e)[:100]}", flush=True)
            time.sleep(3)
        if len(pcm) >= total * BPS:
            break
    OUT.mkdir(exist_ok=True)
    out = OUT / f"{name}_raw.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(48000)
        w.writeframes(bytes(pcm[: (len(pcm) // 4) * 4]))
    print(f"ok {len(pcm) / BPS:.1f}s -> {out}", flush=True)


if __name__ == "__main__":
    main()
