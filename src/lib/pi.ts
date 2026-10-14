/** The Pi kiosk's local helper (scripts/pi/helper.py): only reachable on the Pi itself, never the network. */
export const DESKTOP_HELPER_URL = 'http://127.0.0.1:8765/exit';
export const SHUTDOWN_HELPER_URL = 'http://127.0.0.1:8765/shutdown';
export const RESTART_HELPER_URL = 'http://127.0.0.1:8765/restart';
