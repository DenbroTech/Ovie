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

def ovie_url() -> str:
    try:
        return (DIR / "url").read_text().strip() or "https://denbrotech.github.io/Ovie/"
    except OSError:
        return "https://denbrotech.github.io/Ovie/"


def page(title: str, sub: str) -> bytes:
    # If the Pi doesn't power off within a minute, a "Back to Ovie" link fades in so the screen is never stuck.
    return f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Ovie</title><style>@keyframes show{{to{{opacity:1}}}}a{{opacity:0;animation:show .5s 60s forwards;
display:inline-block;margin-top:32px;padding:14px 24px;border-radius:12px;background:#f2ece3;color:#1b1916;
text-decoration:none;font-size:20px}}</style><body style="margin:0;height:100vh;display:grid;place-items:center;
background:#1b1916;color:#f2ece3;font:700 28px system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box">
<div>{title}<br><span style="font-size:18px;font-weight:600;color:#b3a99b">{sub}</span><br>
<a href="{ovie_url()}">Didn't work? Back to Ovie</a></div></body>""".encode()


def run(cmd: str):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode:
        print(f"helper: '{cmd}' failed ({r.returncode}): {r.stderr.strip()}", flush=True)


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
            threading.Timer(2.0, lambda: run(cmd)).start()
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
        # Anything else (e.g. a button newer than this helper): go back to Ovie rather than a dead-end error page.
        self.send_response(302)
        self.send_header("Location", ovie_url())
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
