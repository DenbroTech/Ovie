#!/usr/bin/env python3
"""Tiny local helper for the Ovie kiosk. Listens on 127.0.0.1 only (nothing else on the
network can reach it). Ovie's "Switch to the desktop" button opens /exit, which closes
the full-screen Ovie and stops it coming back until you tap the Ovie icon or restart."""
import http.server
import os
import pathlib
import subprocess
import threading

DIR = pathlib.Path.home() / ".ovie-kiosk"
FLAG = DIR / "desktop-mode"
PORT = int(os.environ.get("OVIE_HELPER_PORT", "8765"))
KILL = os.environ.get("OVIE_HELPER_KILL", "pkill -f ovie-kiosk/profile")

PAGE = b"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Ovie</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#1b1916;
color:#f2ece3;font:700 28px system-ui,sans-serif;text-align:center">
<div>Switching to the desktop&hellip;<br><span style="font-size:18px;font-weight:600;color:#b3a99b">
Tap the Ovie icon on the desktop (or restart) to come back.</span></div></body>"""


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] == "/exit":
            DIR.mkdir(exist_ok=True)
            FLAG.write_text("chosen from Ovie settings\n")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(PAGE)))
            self.end_headers()
            self.wfile.write(PAGE)
            threading.Timer(1.5, lambda: subprocess.run(KILL, shell=True)).start()
            return
        if self.path == "/ok":
            body = b"ovie-kiosk"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
