"""録った声を Gemini に聞き取らせ、台本と違う言葉・余計な言葉が入っていないかを確かめる。"""
from __future__ import annotations

import base64
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent / "out" / "voices"
import os
MODEL = os.environ.get("HEAR_MODEL", "gemini-flash-lite-latest")
ENV = Path("/Users/shimpeiyamakawa/projects/2nd-brain-project/.env")


def load_key() -> str:
    for line in ENV.read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("GEMINI_API_KEY not found")


def to_wav(cid: str) -> Path:
    wav = OUT / f"{cid}.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1",
                    "-i", str(OUT / f"{cid}.pcm"), str(wav)], check=True)
    return wav


def hear(key: str, wav: Path) -> str:
    body = {"contents": [{"parts": [
        {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(wav.read_bytes()).decode()}},
        {"text": "この音声で聞こえる声を、聞こえたとおりにカタカナかひらがなで書き出してください。声のほかに何も書かないでください。何も聞こえなければ「(なし)」と書いてください。"},
    ]}]}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=60) as r:
        res = json.loads(r.read())
    return res["candidates"][0]["content"]["parts"][0]["text"].strip()


def main() -> None:
    key = load_key()
    tr = json.loads((OUT / "transcript.json").read_text())
    ids = sys.argv[1:] or list(tr)
    for cid in ids:
        wav = to_wav(cid)
        heard = ""
        for attempt in range(3):
            try:
                heard = hear(key, wav)
                break
            except Exception as e:  # noqa: BLE001 - 混雑は少し待ってやり直す
                heard = f"(失敗 {e})"
                time.sleep(5)
        tr[cid]["heard"] = heard
        print(f"{cid} ({tr[cid]['sec']}s) 台本「{tr[cid]['text']}」 → 聞こえた「{heard}」", flush=True)
        time.sleep(2)
    (OUT / "transcript.json").write_text(json.dumps(tr, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
