"""本物のタッチ (CDP) で、押す → 漕ぐ → 離す → 枝をタッチ が通るかを確かめる"""
import asyncio

from playwright.async_api import async_playwright


async def main() -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1180, "height": 820}, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        errs: list[str] = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://127.0.0.1:8650/")
        await pg.wait_for_timeout(500)
        await pg.tap("#play"); await pg.wait_for_timeout(300)
        await pg.tap("#stages button >> nth=0"); await pg.wait_for_timeout(800)
        cdp = await ctx.new_cdp_session(pg)

        async def touch(kind: str, x: float, y: float) -> None:
            pts = [] if kind == "touchEnd" else [{"x": x, "y": y, "id": 1}]
            await cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": pts})

        await touch("touchStart", 590, 300)
        await pg.wait_for_timeout(2200)
        st = await pg.evaluate("({mode: __tsuta.world.m.mode, holding: __tsuta.world.holding, vx: Math.round(__tsuta.world.m.vx)})")
        print("押している間:", st)
        # 揺れが上へ向かう時に離す
        for _ in range(200):
            v = await pg.evaluate("__tsuta.world.m.vy")
            if v < -150:
                break
            await pg.wait_for_timeout(10)
        await touch("touchEnd", 0, 0)
        await pg.wait_for_timeout(120)
        print("離した後:", await pg.evaluate("({mode: __tsuta.world.m.mode, started: __tsuta.world.started})"))
        # 届く枝の画面位置をタッチ
        target = await pg.evaluate("""(() => { const w = __tsuta.world; const m = w.m;
          let best=null, bd=1e9; for (const a of w.anchors) { if (a.kind!=='branch' || a.id===0) continue; const d=Math.hypot(a.x-m.x,a.y-m.y); if (d<340 && a.y < m.y && d<bd){bd=d;best=a;} }
          if(!best) return null; const R = document.getElementById('game'); const s = R.clientWidth/1200; return {x: best.x*s, y: null, wx: best.x, wy: best.y}; })()""")
        print("狙う枝:", target)
        await pg.wait_for_timeout(50)
        if target:
            sy = await pg.evaluate(f"(() => {{ const c=document.getElementById('game'); const s=c.clientWidth/1200; const w=__tsuta.world; return null; }})()")
        # 画面の上の方 (枝のある側) をタッチ: 方向で吸い付くはず
        await touch("touchStart", 700, 150)
        await pg.wait_for_timeout(400)
        print("タッチ後:", await pg.evaluate("({mode: __tsuta.world.m.mode, anchor: __tsuta.world.m.anchor && __tsuta.world.m.anchor.id, whiffs: __tsuta.world.whiffs})"))
        await touch("touchEnd", 0, 0)
        print("errors:", errs)
        await b.close()


asyncio.run(main())
