"""[使わない: 言葉を話す声は不採用。動物の声は make_voices.py で本物の録音から作る] Gemini Live で動物たちの声 (短いセリフ) を録る。声優として演技させ、文字起こしで中身を照合する。

usage: python3 tools/gen_voices.py            出力: tools/out/voices/<id>.pcm と transcript.json
       python3 tools/gen_voices.py <id> ...    指定の声だけ録り直す
鍵は 2nd-brain-project/.env の GEMINI_API_KEY を読む (このリポジトリには置かない)。
"""
from __future__ import annotations

import base64
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, "/Users/shimpeiyamakawa/projects/2nd-brain-project/scripts/voice-conversation")
from verify_live import WebSocket  # noqa: E402

OUT = Path(__file__).parent / "out" / "voices"
ENV = Path("/Users/shimpeiyamakawa/projects/2nd-brain-project/.env")
PATH = "/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key="
MODEL = "models/gemini-3.8-live"

CHARS = {
    "monkey": ("Puck", "あなたは子ども向けアニメの声優です。主人公は元気でいたずら好きな小さな子ザル。"
               "送られてくるセリフだけを、その子ザルとして、短く、感情たっぷりに、高めの声で演技して言ってください。"
               "セリフ以外の言葉、説明、あいさつは一切言わないでください。"),
    "baby": ("Leda", "あなたは子ども向けアニメの声優です。役は、木の上に取り残された、とても小さな赤ちゃんザル。"
             "送られてくるセリフだけを、その赤ちゃんザルとして、かわいく、高い声で演技して言ってください。"
             "セリフ以外の言葉、説明、あいさつは一切言わないでください。"),
    "toucan": ("Fenrir", "あなたは子ども向けアニメの声優です。役は、力持ちだけど少しドジな、おしゃべりな鳥のオオハシ。"
               "送られてくるセリフだけを、そのオオハシとして、コミカルに、大げさに演技して言ってください。"
               "セリフ以外の言葉、説明、あいさつは一切言わないでください。"),
}

# (id, 役, セリフ)
LINES = [
    ("m_jump1", "monkey", "ウキーッ！"), ("m_jump2", "monkey", "ほいっ！"), ("m_jump3", "monkey", "それっ！"),
    ("m_grab1", "monkey", "ウッキー！"), ("m_grab2", "monkey", "キャッ！"), ("m_grab3", "monkey", "ウキキッ！"),
    ("m_combo1", "monkey", "ウッキッキー！"), ("m_combo2", "monkey", "いえーい！"),
    ("m_loop", "monkey", "わーーーい！"),
    ("m_kick1", "monkey", "えいっ！"), ("m_kick2", "monkey", "とうっ！"),
    ("m_whiff1", "monkey", "あれっ？"), ("m_whiff2", "monkey", "ウキュ？"),
    ("m_hurt1", "monkey", "ウギャーッ！いたたたた！"), ("m_hurt2", "monkey", "ひゃーっ！つめたーい！"),
    ("m_fail", "monkey", "ウキュ〜……"),
    ("m_clear", "monkey", "ウッキッキー！やったー！"),
    ("m_bounce", "monkey", "ボヨーン！"),
    ("m_scared", "monkey", "わわわっ！"),
    ("m_fruit1", "monkey", "うまっ！"), ("m_fruit2", "monkey", "おいしー！"),
    ("b_help1", "baby", "たすけてー！"), ("b_help2", "baby", "こっちだよー！"),
    ("b_saved1", "baby", "ありがとー！"), ("b_saved2", "baby", "キャッキャッ！"),
    ("t_grab", "toucan", "クワッ！まかせて！"),
    ("t_carry1", "toucan", "よいしょ、よいしょ！"), ("t_carry2", "toucan", "ふんぬぬぬー！"),
    ("t_tired", "toucan", "もう、だめぇ〜！"),
    ("t_drop", "toucan", "クワワーッ！"),
]


def load_key() -> str:
    for line in ENV.read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("GEMINI_API_KEY not found")


def record(key: str, cid: str, role: str, text: str) -> tuple[str, str, float]:
    voice, instruction = CHARS[role]
    ws = WebSocket("generativelanguage.googleapis.com", PATH + key, 60)
    pcm = bytearray()
    said = ""
    try:
        ws.send_json({"setup": {
            "model": MODEL,
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}},
            "systemInstruction": {"parts": [{"text": instruction}]},
            "outputAudioTranscription": {},
        }})
        deadline = time.time() + 60
        while time.time() < deadline:
            if ws.receive_json().get("setupComplete") is not None:
                break
        ws.send_json({"realtimeInput": {"text": text}})
        while time.time() < deadline:
            msg = ws.receive_json()
            content = msg.get("serverContent", {})
            tr = content.get("outputTranscription", {}).get("text")
            if tr:
                said += tr
            for part in content.get("modelTurn", {}).get("parts", []):
                inline = part.get("inlineData") if isinstance(part, dict) else None
                if inline and inline.get("data"):
                    pcm.extend(base64.b64decode(inline["data"]))
            if content.get("turnComplete"):
                break
    finally:
        ws.close()
    (OUT / f"{cid}.pcm").write_bytes(bytes(pcm))
    return cid, said, len(pcm) / (24000 * 2)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    key = load_key()
    want = set(sys.argv[1:])
    jobs = [ln for ln in LINES if not want or ln[0] in want]
    tpath = OUT / "transcript.json"
    result = json.loads(tpath.read_text()) if tpath.exists() else {}
    with ThreadPoolExecutor(5) as ex:
        futs = [ex.submit(record, key, *ln) for ln in jobs]
        for (cid, role, text), f in zip(jobs, futs):
            try:
                _, said, sec = f.result()
                result[cid] = {"text": text, "said": said, "sec": round(sec, 2)}
                print(f"{cid}: {sec:.2f}s  台本「{text}」 聞こえた「{said}」", flush=True)
            except Exception as e:  # noqa: BLE001 - 1 本の失敗で全体を止めない
                print(f"{cid}: 失敗 {type(e).__name__} {str(e)[:80]}", flush=True)
    tpath.write_text(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
