"""動物の声を作る: 本物のサル・オオハシの録音から鳴き声を切り出す → 高さを変える → 音量をそろえる
→ assets/voice/<id>.m4a。src/voices.js (声の一覧) と assets/voice/CREDITS.md も書く。
言葉は一切入れない (ドンキーコング流に、鳴き声とうなり声だけ)。
先に tools/fetch_animal_sounds.py で録音を取ってくること。"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
SRC = HERE / "out" / "animal"
ASSET = HERE.parent / "assets" / "voice"
SR = 44100

# id: (録音, [(始め秒, 終わり秒), ...], 高さの倍率, 鳴き声の間の秒)
# 倍率は 1 より大きいほど高く速い (小さくてかわいいサルに寄せる)
RECIPES: dict[str, tuple[str, list[tuple[float, float]], float, float]] = {
    # 主人公のサル: チンパンジーの「ホッホッ (低い息) → キャーッ (山場)」を主に、ボノボの高い声を足す
    "m_jump1": ("panthoot", [(2.58, 2.94)], 1.5, 0),
    "m_jump2": ("panthoot", [(5.00, 5.24)], 1.5, 0),
    "m_jump3": ("panthoot", [(4.56, 4.87)], 1.6, 0),
    "m_grab1": ("chimp_alarm6", [(0.16, 0.60)], 1.3, 0),
    "m_grab2": ("chimp_alarm5", [(0.32, 0.66)], 1.4, 0),
    "m_grab3": ("panthoot", [(3.63, 3.86), (4.12, 4.32)], 1.6, 0.04),
    "m_combo1": ("panthoot", [(4.56, 4.87), (5.00, 5.24), (5.46, 6.04)], 1.5, 0.03),
    "m_combo2": ("panthoot", [(6.60, 7.14), (7.25, 7.79)], 1.15, 0.03),
    "m_loop": ("panthoot", [(4.12, 4.32), (4.56, 4.87), (5.00, 5.24), (6.60, 7.14), (7.25, 7.79), (7.90, 8.43)], 1.35, 0.03),
    "m_kick1": ("chimp_alarm", [(0.41, 0.74)], 1.3, 0),
    "m_kick2": ("gibbon_rehab", [(4.24, 4.64)], 1.25, 0),
    "m_whiff1": ("jmac4", [(0.06, 0.58)], 1.15, 0),
    "m_whiff2": ("lar", [(1.63, 2.07)], 1.2, 0),
    "m_hurt1": ("panthoot", [(6.60, 7.14), (7.25, 7.79), (7.90, 8.43)], 1.2, 0.02),
    "m_hurt2": ("bonobo", [(4.27, 4.84), (3.25, 3.64)], 1.0, 0.04),
    "m_fail": ("jmac3", [(0.27, 0.78)], 0.8, 0),
    "m_clear": ("panthoot", [(3.63, 3.86), (4.12, 4.32), (4.56, 4.87), (5.00, 5.24), (5.46, 6.04),
                             (6.60, 7.14), (7.25, 7.79), (7.90, 8.43)], 1.3, 0.03),
    "m_bounce": ("panthoot", [(5.46, 6.04)], 1.6, 0),
    "m_scared": ("panthoot", [(6.60, 7.14), (7.25, 7.79)], 1.45, 0.02),
    "m_fruit1": ("panthoot", [(2.58, 2.94), (3.20, 3.39)], 1.7, 0.03),
    "m_fruit2": ("chimp_alarm5", [(0.32, 0.66)], 1.55, 0),
    # 小ザル: ニホンザルの「クー」(仲間を呼ぶ声) を高くして赤ちゃんに
    "b_help1": ("jmac2", [(0.27, 0.79), (1.11, 1.62)], 1.45, 0.18),
    "b_help2": ("jmac3", [(1.95, 2.46), (2.79, 3.29)], 1.5, 0.18),
    "b_saved1": ("bonobo", [(3.25, 3.64), (4.27, 4.84)], 1.25, 0.05),
    "b_saved2": ("panthoot", [(9.87, 10.05), (10.24, 10.39), (10.59, 10.75)], 1.9, 0.03),
    # オオハシ: 本物のオオハシのガーガー・キョッキョッ
    "t_grab": ("keel", [(0.97, 1.31), (0.39, 0.68)], 1.0, 0.06),
    "t_carry1": ("keel", [(2.20, 2.40), (2.78, 2.98), (3.37, 3.57), (3.99, 4.19)], 1.05, 0.12),
    "t_carry2": ("toco", [(7.60, 7.91), (8.03, 8.36), (8.94, 9.29)], 1.0, 0.06),
    "t_tired": ("keel", [(4.57, 4.77), (5.20, 5.40), (5.77, 5.98)], 0.8, 0.25),
    "t_drop": ("redbill", [(3.49, 3.78), (5.88, 6.27)], 1.05, 0.04),
}


def load(name: str) -> np.ndarray:
    """録音を 44.1kHz・1ch にし、低いうなり (風・マイク) と雑音を軽く落とす。"""
    raw = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(SRC / "src" / f"{name}.ogg"),
                          "-af", "highpass=f=180,afftdn=nf=-30", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def build(audio: np.ndarray, cuts: list[tuple[float, float]], rate: float, gap: float) -> np.ndarray:
    parts = []
    for a, b in cuts:
        seg = audio[int(a * SR):int(b * SR)].copy()
        f = min(len(seg) // 4, int(0.012 * SR))
        seg[:f] *= np.linspace(0, 1, f)
        seg[-f:] *= np.linspace(1, 0, f)
        parts += [seg, np.zeros(int(gap * SR), dtype=np.float32)]
    x = np.concatenate(parts[:-1])
    x = np.interp(np.arange(0, len(x) - 1, rate), np.arange(len(x)), x)  # 高く速く (小さな動物らしく)
    # 一番大きい 50ms の強さでそろえる (短い声も長い声も同じくらいに聞こえる)
    w = int(0.05 * SR)
    loud = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode="valid").max())
    x = x * (0.25 / (loud + 1e-9))
    return np.clip(x, -0.98, 0.98)


def credits_md() -> str:
    cr = json.loads((SRC / "credits.json").read_text())
    used = sorted({r[0] for r in RECIPES.values()})
    lines = ["# 動物の声の出典", "", "ゲームの鳴き声は、次の録音から切り出し、高さと音量を変えて作りました。",
             "BY-SA の録音から作った声は、同じ CC BY-SA で配布します。", ""]
    for n in used:
        c = cr[n]
        artist = re.sub(r"<[^>]+>", "", c["artist"]).strip()
        lines.append(f"- {c['title'][5:]} / {artist} / {c['license']} / {c['page']}")
    return "\n".join(lines) + "\n"


def main() -> None:
    ASSET.mkdir(parents=True, exist_ok=True)
    cache: dict[str, np.ndarray] = {}
    ids = []
    for cid, (name, cuts, rate, gap) in sorted(RECIPES.items()):
        if name not in cache:
            cache[name] = load(name)
        x = build(cache[name], cuts, rate, gap)
        pcm = (x * 32767).astype(np.int16).tobytes()
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1",
                        "-i", "-", "-c:a", "aac", "-b:a", "64k", str(ASSET / f"{cid}.m4a")], input=pcm, check=True)
        ids.append(cid)
        print(f"{cid}: {len(x) / SR:.2f}s  {name} x{rate}")
    (HERE.parent / "src" / "voices.js").write_text("// tools/make_voices.py が書く。手で直さない\nexport const VOICE_IDS = " + json.dumps(ids) + ";\n")
    (ASSET / "CREDITS.md").write_text(credits_md())


if __name__ == "__main__":
    main()
