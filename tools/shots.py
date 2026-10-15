"""画面写真で検品する (iPad 横 1180x820 / 縦 820x1180)。使い方: python3 tools/shots.py <名前> <URL の後ろ> <待つ秒,...>"""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

out = Path(__file__).parent / "out"
out.mkdir(exist_ok=True)


async def main() -> None:
    name, query, waits = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3].split(",")]
    portrait = len(sys.argv) > 4 and sys.argv[4] == "portrait"
    vw, vh = (820, 1180) if portrait else (1180, 820)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": vw, "height": vh}, device_scale_factor=1, has_touch=True)
        errs: list[str] = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto(f"http://127.0.0.1:8650/{query}")
        prev = 0.0
        for i, wsec in enumerate(waits):
            await pg.wait_for_timeout(int((wsec - prev) * 1000))
            prev = wsec
            await pg.screenshot(path=str(out / f"{name}_{i}.png"))
        print("errors:", errs)
        await b.close()


asyncio.run(main())
