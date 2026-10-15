"""icon.png を作る (tools/icon.html を開いて canvas を保存)。開発サーバーが動いている前提"""
import asyncio
import base64
from pathlib import Path

from playwright.async_api import async_playwright


async def main() -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.goto("http://127.0.0.1:8650/tools/icon.html")
        await pg.wait_for_function("window.done")
        data = await pg.evaluate("window.done")
        (Path(__file__).resolve().parent.parent / "icon.png").write_bytes(base64.b64decode(data.split(",")[1]))
        await b.close()


asyncio.run(main())
