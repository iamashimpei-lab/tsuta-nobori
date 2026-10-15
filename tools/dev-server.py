"""開発用サーバー (キャッシュ無効)。python3 tools/dev-server.py で http://localhost:8650/"""
import http.server
from pathlib import Path


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    handler = lambda *a, **k: NoCache(*a, directory=str(root), **k)  # noqa: E731
    http.server.ThreadingHTTPServer(("127.0.0.1", 8650), handler).serve_forever()
