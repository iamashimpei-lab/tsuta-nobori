"""公開の前に呼ぶ: 最終更新の時刻 (シンガポール時間) を src/version.js に書き、sw.js の VERSION を上げる。"""
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

root = Path(__file__).resolve().parent.parent
now = datetime.now(timezone(timedelta(hours=8)))
stamp = now.strftime("%Y-%m-%d %H:%M")
(root / "src" / "version.js").write_text(f"// tools/stamp.py が書く。手で直さない\nexport const LAST_UPDATE = '{stamp}';\n")
sw = root / "sw.js"
sw.write_text(re.sub(r"const VERSION = '[^']*';", f"const VERSION = 'tsuta-{now.strftime('%Y%m%d%H%M')}';", sw.read_text()))
print(stamp)
