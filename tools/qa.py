"""画面ごとの検品写真を撮る (iPad 横)。python3 tools/qa.py"""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

out = Path(__file__).parent / "out"
out.mkdir(exist_ok=True)
BASE = "http://127.0.0.1:8650/"


async def main() -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs: list[str] = []

        async def page(w: int = 1180, h: int = 820):
            pg = await b.new_page(viewport={"width": w, "height": h}, has_touch=True)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            return pg

        pg = await page()
        await pg.goto(BASE)
        await pg.wait_for_timeout(800)
        await pg.click("#play")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(out / "map.png"))
        await pg.click("#mapback"); await pg.click("#tovillage")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(out / "village0.png"))
        await pg.evaluate("localStorage.setItem('tsuta-nobori-save-v1', JSON.stringify({bank: 50, babies: {'1-1': true, '1-2': true, '1-3': true}, stars: {'1-1': [true,true,false], '1-2': [true,false,false]}}))")
        await pg.reload(); await pg.wait_for_timeout(500)
        await pg.click("#tovillage"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(out / "village3.png"))
        await pg.click("#villageback"); await pg.click("#toshop"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(out / "shop.png"))
        await pg.click("#shopback"); await pg.click("#play"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(out / "map2.png"))
        # 1-1 を手で: チュートリアル表示
        await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(400)
        await pg.click("#play"); await pg.click("#stages button >> nth=0")
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=str(out / "tut1.png"))
        await pg.mouse.move(600, 300); await pg.mouse.down(); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=str(out / "tut2.png"))
        await pg.close()
        # 仕掛けの見た目: 自動プレイ
        for name, q, waits in [("bird", "?auto=1&seed=5", [8, 10, 12]), ("thin", "?auto=2&seed=4", [6, 9]), ("vine", "?auto=3&seed=2", [10, 13, 16]), ("mix", "?auto=4&seed=9", [12, 20, 30])]:
            pg = await page()
            await pg.goto(BASE + q)
            prev = 0
            for i, s in enumerate(waits):
                await pg.wait_for_timeout(int((s - prev) * 1000)); prev = s
                await pg.screenshot(path=str(out / f"{name}{i}.png"))
            await pg.close()
        # 結果画面 (1-1 自動で最後まで)
        pg = await page()
        await pg.goto(BASE + "?auto=0&seed=3")
        await pg.wait_for_function("document.querySelector('#result') && !document.querySelector('#result').classList.contains('hidden')", timeout=90000)
        await pg.wait_for_timeout(1800)
        await pg.screenshot(path=str(out / "result.png"))
        await pg.close()
        # 縦持ち
        pg = await page(820, 1180)
        await pg.goto(BASE + "?auto=0&seed=8"); await pg.wait_for_timeout(7000)
        await pg.screenshot(path=str(out / "portrait.png"))
        await pg.close()
        print("errors:", errs)
        await b.close()


asyncio.run(main())
