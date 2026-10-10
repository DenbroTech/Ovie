#!/usr/bin/env bash
# Ovie kiosk installer for Raspberry Pi OS (desktop). Run as your normal user, not root:
#   curl -fsSL https://raw.githubusercontent.com/DenbroTech/Ovie/main/scripts/pi/install.sh | bash
# It only adds files in your home folder (plus turning off screen blanking). Nothing else is removed.
# Undo with: bash ~/.ovie-kiosk/uninstall.sh
set -euo pipefail
RAW="${OVIE_RAW:-https://raw.githubusercontent.com/DenbroTech/Ovie/main/scripts/pi}"
URL="${OVIE_URL:-https://denbrotech.github.io/Ovie/}"
DIR="$HOME/.ovie-kiosk"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*"; }

[ "$(id -u)" = "0" ] && { echo "Run this as your normal user (without sudo)."; exit 1; }

say "Checking this Pi"
grep -q PRETTY_NAME /etc/os-release && grep PRETTY_NAME /etc/os-release | cut -d= -f2
BROWSER="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$BROWSER" ]; then
  say "Installing Chromium (needs your password)"
  sudo apt-get update && (sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser)
  BROWSER="$(command -v chromium-browser || command -v chromium)"
fi
VER="$("$BROWSER" --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo 0)"
echo "Chromium version: $VER"
if [ "${VER:-0}" -lt 111 ]; then
  warn "Chromium $VER is too old for Ovie (needs 111+). Update first:  sudo apt update && sudo apt full-upgrade -y   then run this again."
  exit 1
fi
command -v python3 >/dev/null || { warn "python3 is missing: sudo apt install -y python3"; exit 1; }

say "Installing Ovie kiosk files into $DIR"
mkdir -p "$DIR"
for f in kiosk.sh helper.py uninstall.sh; do
  if [ -f "$(dirname "$0")/$f" ] && [ "${OVIE_LOCAL:-}" = "1" ]; then cp "$(dirname "$0")/$f" "$DIR/$f"
  else curl -fsSL "$RAW/$f" -o "$DIR/$f"; fi
done
chmod +x "$DIR/kiosk.sh" "$DIR/uninstall.sh"
echo "$URL" > "$DIR/url"

say "Starting Ovie automatically when the Pi turns on"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/ovie-kiosk.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Ovie kiosk
Exec=$DIR/kiosk.sh --boot
X-GNOME-Autostart-enabled=true
DESKTOP
# labwc (current Raspberry Pi OS) also reads its own autostart file
if [ -d "$HOME/.config/labwc" ] || command -v labwc >/dev/null; then
  mkdir -p "$HOME/.config/labwc"
  touch "$HOME/.config/labwc/autostart"
  grep -q ovie-kiosk "$HOME/.config/labwc/autostart" || echo "$DIR/kiosk.sh --boot &  # ovie-kiosk" >> "$HOME/.config/labwc/autostart"
fi
# wayfire (older Bookworm)
if [ -f "$HOME/.config/wayfire.ini" ] && ! grep -q ovie-kiosk "$HOME/.config/wayfire.ini"; then
  if grep -q '^\[autostart\]' "$HOME/.config/wayfire.ini"; then
    sed -i "/^\[autostart\]/a ovie = $DIR/kiosk.sh --boot  # ovie-kiosk" "$HOME/.config/wayfire.ini"
  else
    printf '\n[autostart]\novie = %s/kiosk.sh --boot  # ovie-kiosk\n' "$DIR" >> "$HOME/.config/wayfire.ini"
  fi
fi

say "Adding an Ovie icon to the desktop and the menu (to come back from the desktop)"
mkdir -p "$HOME/.local/share/applications" "$HOME/Desktop"
curl -fsSL "${URL}icons/icon-192.png" -o "$DIR/ovie.png" || true
for target in "$HOME/.local/share/applications/ovie.desktop" "$HOME/Desktop/ovie.desktop"; do
  cat > "$target" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Ovie
Comment=Open Ovie full screen
Exec=$DIR/kiosk.sh
Icon=$DIR/ovie.png
Terminal=false
Categories=Utility;
DESKTOP
  chmod +x "$target"
done
gio set "$HOME/Desktop/ovie.desktop" metadata::trusted true 2>/dev/null || true

say "Keeping the screen awake"
if command -v raspi-config >/dev/null; then sudo raspi-config nonint do_blanking 1 || true; fi

say "Other things that start at power-on (check none of them cover Ovie)"
ls "$HOME/.config/autostart" 2>/dev/null | grep -v ovie-kiosk || echo "(none)"
[ -f "$HOME/.config/labwc/autostart" ] && grep -v ovie-kiosk "$HOME/.config/labwc/autostart" | grep -v '^\s*$' || true
[ -f "$HOME/.config/lxsession/LXDE-pi/autostart" ] && cat "$HOME/.config/lxsession/LXDE-pi/autostart" || true

say "Done! Restart the Pi:  sudo reboot"
echo "Ovie opens full screen. In Ovie: Settings → This device → 'Switch to the desktop' to use the Pi as a computer."
echo "Undo everything with:  bash $DIR/uninstall.sh"
