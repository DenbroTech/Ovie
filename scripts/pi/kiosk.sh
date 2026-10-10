#!/usr/bin/env bash
# Ovie kiosk launcher: shows Ovie full screen and brings it back if Chromium ever closes,
# unless someone chose "Switch to the desktop" in Ovie (or ran ovie-desktop).
set -u
DIR="$HOME/.ovie-kiosk"
URL="$(cat "$DIR/url" 2>/dev/null || echo 'https://denbrotech.github.io/Ovie/')"
FLAG="$DIR/desktop-mode"
LOG="$DIR/kiosk.log"
mkdir -p "$DIR"

# Only one launcher at a time (autostart may call us twice).
exec 9>"$DIR/kiosk.lock"
flock -n 9 || exit 0

# Starting the launcher (power-on or the desktop Ovie icon) always means "show Ovie".
rm -f "$FLAG"

BROWSER="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$BROWSER" ]; then echo "$(date) Chromium not found" >>"$LOG"; exit 1; fi

# Wait up to a minute for the network after boot.
for _ in $(seq 1 "${OVIE_NET_WAIT:-30}"); do
  getent hosts denbrotech.github.io >/dev/null 2>&1 && break
  sleep 2
done

# Fetch the newest helper (new Settings buttons arrive without reinstalling); keep the old one if anything's off.
RAW="$(cat "$DIR/raw" 2>/dev/null || echo 'https://raw.githubusercontent.com/DenbroTech/Ovie/main/scripts/pi')"
if curl -fsSL --max-time 15 "$RAW/helper.py" -o "$DIR/helper.py.new" 2>/dev/null && python3 -m py_compile "$DIR/helper.py.new" 2>/dev/null; then
  if ! cmp -s "$DIR/helper.py.new" "$DIR/helper.py"; then
    mv "$DIR/helper.py.new" "$DIR/helper.py"
    pkill -f "$DIR/helper.py" 2>/dev/null; sleep 1
  fi
fi
rm -f "$DIR/helper.py.new"

# The little helper behind Ovie's Settings buttons (127.0.0.1 only).
if ! pgrep -f "$DIR/helper.py" >/dev/null; then
  nohup python3 "$DIR/helper.py" >>"$LOG" 2>&1 9>&- &   # 9>&-: don't hand the launcher lock to the helper
fi

# Keep the screen awake while Ovie is showing (works on X11; Wayland setups use raspi-config's setting).
command -v xset >/dev/null && [ -n "${DISPLAY:-}" ] && { xset s off; xset -dpms; xset s noblank; } 2>/dev/null


# Chromium remembers it was "killed" and nags; clear that so it never shows a bubble.
PREFS="$DIR/profile/Default/Preferences"
[ -f "$PREFS" ] && sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"

while [ ! -f "$FLAG" ]; do
  echo "$(date) starting Ovie" >>"$LOG"
  "$BROWSER" \
    --kiosk "$URL" \
    --user-data-dir="$DIR/profile" \
    --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
    --autoplay-policy=no-user-gesture-required \
    --overscroll-history-navigation=0 --disable-pinch \
    --disable-features=Translate,TranslateUI \
    --check-for-update-interval=31536000 \
    --password-store=basic \
    --ozone-platform-hint=auto \
    >>"$LOG" 2>&1 9>&-
  [ -f "$FLAG" ] && break
  echo "$(date) Chromium closed; restarting in 3s" >>"$LOG"
  sleep 3
done
echo "$(date) desktop mode" >>"$LOG"
