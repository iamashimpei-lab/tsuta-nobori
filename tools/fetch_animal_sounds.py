"""本物の動物の鳴き声 (Wikimedia Commons の自由に使える録音) を取ってくる。
出力: tools/out/animal/src/<名前>.ogg と credits.json (作者・ライセンス・元ページ)。"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent / "out" / "animal"
UA = {"User-Agent": "tsuta-nobori/1.0 (https://github.com/iamashimpei-lab/tsuta-nobori)"}
FILES = {
    "panthoot": "File:Pant-hoot call made by a male chimpanzee.ogg",
    "bonobo": "File:Enduring-voice-recognition-in-bonobos-srep22046-s3.oga",
    "chimp_alarm": "File:Chimpanzee-Alarm-Call-Production-Meets-Key-Criteria-for-Intentionality-pone.0076674.s004.oga",
    "chimp_alarm5": "File:Chimpanzee-Alarm-Call-Production-Meets-Key-Criteria-for-Intentionality-pone.0076674.s005.oga",
    "chimp_alarm6": "File:Chimpanzee-Alarm-Call-Production-Meets-Key-Criteria-for-Intentionality-pone.0076674.s006.oga",
    "jmac2": "File:Role-of-vocal-tract-characteristics-in-individual-discrimination-by-Japanese-macaques-(Macaca-srep32042-s2.oga",
    "jmac3": "File:Role-of-vocal-tract-characteristics-in-individual-discrimination-by-Japanese-macaques-(Macaca-srep32042-s3.oga",
    "jmac4": "File:Role-of-vocal-tract-characteristics-in-individual-discrimination-by-Japanese-macaques-(Macaca-srep32042-s4.oga",
    "gibbon_rehab": "File:Gibbon Rehabilitation Project - Phuket - 20131029 - Cris de singes 1.ogg",
    "lar": "File:Lar Gibbon hoots.ogg",
    "keel": "File:Keel-billed toucan.ogg",
    "toco": "File:Toco Toucan call (Ramphastos toco).ogg",
    "redbill": "File:Red-Billed Toucan 2.ogg",
}


def main() -> None:
    (OUT / "src").mkdir(parents=True, exist_ok=True)
    url = ("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata"
           "&format=json&titles=" + urllib.parse.quote("|".join(FILES.values())))
    pages = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA)))["query"]["pages"].values()
    by_title = {p["title"]: p for p in pages}
    credits = {}
    for name, title in FILES.items():
        info = by_title[title.replace("_", " ")]["imageinfo"][0]
        meta = info["extmetadata"]
        credits[name] = {"title": title, "page": info["descriptionurl"],
                         "license": meta["LicenseShortName"]["value"],
                         "artist": meta.get("Artist", {}).get("value", "")}
        dst = OUT / "src" / f"{name}.ogg"
        if not dst.exists():
            dst.write_bytes(urllib.request.urlopen(urllib.request.Request(info["url"], headers=UA)).read())
            time.sleep(3)  # Commons は速く取ると断られる
        print(name, credits[name]["license"])
    (OUT / "credits.json").write_text(json.dumps(credits, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
