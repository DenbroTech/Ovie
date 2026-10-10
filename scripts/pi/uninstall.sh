#!/usr/bin/env bash
# Removes the Ovie kiosk (autostart, icons, helper). Your Ovie data online is not touched.
set -u
DIR="$HOME/.ovie-kiosk"
touch "$DIR/desktop-mode" 2>/dev/null
pkill -f "$DIR/helper.py" 2>/dev/null
pkill -f "ovie-kiosk/profile" 2>/dev/null
rm -f "$HOME/.config/autostart/ovie-kiosk.desktop" "$HOME/.local/share/applications/ovie.desktop" "$HOME/Desktop/ovie.desktop"
[ -f "$HOME/.config/labwc/autostart" ] && sed -i '/ovie-kiosk/d' "$HOME/.config/labwc/autostart"
[ -f "$HOME/.config/wayfire.ini" ] && sed -i '/ovie-kiosk/d' "$HOME/.config/wayfire.ini"
echo "Ovie kiosk removed. (Kept $DIR/profile so this screen stays paired; delete $DIR to forget it.)"
