#!/usr/bin/env python3
"""Tiny local helper for the Ovie kiosk. Listens on 127.0.0.1 only (nothing else on the
network can reach it). Ovie's Settings buttons open:
  /exit      close the full-screen Ovie until you tap the Ovie icon or restart
  /shutdown  shut the Pi down safely (then it's safe to switch the power off)
  /restart   restart the Pi"""
import http.server
import os
import pathlib
import subprocess
import threading

DIR = pathlib.Path.home() / ".ovie-kiosk"
FLAG = DIR / "desktop-mode"
PORT = int(os.environ.get("OVIE_HELPER_PORT", "8765"))
KILL = os.environ.get("OVIE_HELPER_KILL", "pkill -f ovie-kiosk/profile")
# Normal desktop users may power off a Pi from its own session; fall back to passwordless sudo (Pi OS default).
POWEROFF = os.environ.get("OVIE_HELPER_POWEROFF", "systemctl poweroff || sudo -n /sbin/shutdown -h now")
REBOOT = os.environ.get("OVIE_HELPER_REBOOT", "systemctl reboot || sudo -n /sbin/shutdown -r now")

def page(title: str, sub: str) -> bytes:
    return f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Ovie</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#1b1916;
color:#f2ece3;font:700 28px system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box">
<div>{title}<br><span style="font-size:18px;font-weight:600;color:#b3a99b">{sub}</span></div></body>""".encode()


SHUTDOWN_PAGE = page("Shutting down&hellip;",
                     "Wait until the screen goes dark and the Pi's green light stops flashing (about 20 seconds),<br>"
                     "then it's safe to switch off the power.")
REBOOT_PAGE = page("Restarting&hellip;", "Ovie will be back in about a minute.")

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
        if self.path.split("?")[0] in ("/shutdown", "/restart"):
            off = self.path.startswith("/shutdown")
            body = SHUTDOWN_PAGE if off else REBOOT_PAGE
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            cmd = POWEROFF if off else REBOOT
            threading.Timer(2.0, lambda: subprocess.run(cmd, shell=True)).start()
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
