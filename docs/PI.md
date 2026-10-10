# Ovie on the Raspberry Pi (wall screen)

The Pi starts straight into Ovie, full screen, every time it's turned on.
In Ovie, **Settings → This device → Switch to the desktop** closes Ovie so you can use the Pi as a normal computer.
To come back, tap the **Ovie** icon on the desktop, or restart the Pi.

Hardware: Raspberry Pi 4 Model B + Jaycar XC9026 7" 1024×600 touchscreen.

## One-time setup (about 10 minutes)

You need a USB keyboard plugged into the Pi for this part (and a mouse helps).

1. Plug the screen into the Pi: HDMI into the **micro-HDMI port next to the USB-C power socket**, and the screen's **"Touch"** micro-USB into a Pi USB port.
2. Turn the Pi on and wait for the desktop.
3. Open **Terminal**: press **Ctrl + Alt + T** (or the black screen icon at the top).
4. Paste or type this line, then press **Enter**:
   ```
   curl -fsSL https://raw.githubusercontent.com/DenbroTech/Ovie/main/scripts/pi/install.sh | bash
   ```
   It checks the Pi, installs Chromium if needed (it may ask for your Pi password), and sets everything up. It ends with **"Done!"**.
   - If it says Chromium is **too old**, run `sudo apt update && sudo apt full-upgrade -y`, wait, then run the line above again.
   - It lists other things that start at power-on (for example your cat game). If one of them also opens full screen, tell me and I'll sort out which one wins.
5. Restart: type `sudo reboot` and press Enter.
6. Ovie opens. Type the **home code** (on your phone: Settings → Home code), then tap **Wall screen**.
   You only do this once; the Pi remembers it.

That's it. You can unplug the keyboard.

## Everyday use

- **Power on** → Ovie.
- **Use the Pi as a computer** → Ovie → Settings → This device → **Switch to the desktop** → Switch.
- **Turning it off** → always shut down first, then switch off the power. Pulling the power while it's running can corrupt the SD card.
  Ovie → Settings → This device → **Shut down the Pi** → Shut down. Wait until the screen goes dark and the Pi's green light stops flashing (about 20 seconds), then switch off at the wall.
- **Restart** → Ovie → Settings → This device → **Restart the Pi**. Ovie comes back by itself in about a minute.
- **Back to Ovie** → double-tap the **Ovie** icon on the desktop (or find Ovie in the menu), or restart.
- If Chromium ever crashes, Ovie comes back by itself within a few seconds.
- New Ovie versions load by themselves (within about 5 minutes), no need to touch the Pi.
- The screen doesn't go to sleep. Alarms can beep without anyone touching the screen first.

## If something's not right

- **Picture doesn't fill the screen / wrong size:** in Terminal run `sudo nano /boot/firmware/cmdline.txt`, add ` video=HDMI-A-1:1024x600@60` at the end of the (single) line, save with Ctrl+O, Enter, Ctrl+X, then `sudo reboot`. (On older systems the file is `/boot/cmdline.txt`.)
- **Touch doesn't work:** check the screen's "Touch" micro-USB cable goes into the Pi.
- **What happened?** The kiosk keeps a log: `cat ~/.ovie-kiosk/kiosk.log`
- **Remove the kiosk** (Pi goes back to normal at power-on): `bash ~/.ovie-kiosk/uninstall.sh`

## How it works (for reference)

| File (in `~/.ovie-kiosk/`) | What it does |
|---|---|
| `kiosk.sh` | Starts Chromium full screen on https://denbrotech.github.io/Ovie/ and restarts it if it closes, unless you chose "Switch to the desktop". Waits for the internet after power-on. |
| `helper.py` | A tiny helper that only listens on the Pi itself (127.0.0.1:8765). Ovie's "Switch to the desktop", "Restart the Pi" and "Shut down the Pi" buttons open it. Nothing on your network can reach it. `kiosk.sh` fetches the newest copy of itself and the helper from GitHub each time it starts, so updates arrive without reinstalling. If the Pi can't power off, a "Back to Ovie" link appears after a minute. |
| `profile/` | Chromium's own data for Ovie: keeps this screen paired. |
| `uninstall.sh` | Removes the autostart, icons and helper. |

Autostart entries: `~/.config/autostart/ovie-kiosk.desktop` (plus `~/.config/labwc/autostart` or `~/.config/wayfire.ini` on newer systems). Screen blanking is turned off with `raspi-config`.
