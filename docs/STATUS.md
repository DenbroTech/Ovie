# Ovie status

## Done: Phase A (plan) + 1. Foundation

- `ovie` schema in the ₲ryd project: `households` (only one can exist), `members` (people), `devices` (paired phones/PCs/wall screen). RLS on all three: only paired devices get in, and there are no anon policies. RPCs: `setup_state`, `setup_household`, `people_for_code`, `pair_device`, `regenerate_invite_code`, `touch_device`. Realtime for Ovie tables.
- App, no logins: first run sets up the home; every other device types the home code once and taps who it is for (or "Wall screen"). Home (clock, date, greeting from Ovie the sheep, app grid). Settings: this device (who uses it, theme, remove), people (add/edit/remove, colours), home (name, time zone, home code), devices (last used, remove a lost phone).
- Pages slide in and out; offline banner; changes paused while offline; friendly error messages.
- PWA: manifest, Ovie icons, network-first service worker, automatic reload after a deploy.
- Backup/restore scripts for the `ovie` schema only, with a safety check.

## Waiting on you

- Approve the `ovie_device_pairing` migration (the Supabase connector needs your OK because it replaces the two empty tables).
- Expose the `ovie` schema (docs/SETUP.md, step 1).
- Turn on anonymous sign-ins (docs/SETUP.md, step 2). Until then Ovie shows a message saying exactly that.

## Next

2. Dashboard → 3. Tasks and recurring jobs → 4. Shopping → 5. Calendar → 6. Watch → 7. Casa (proposal first).

## Later

Screensaver for the wall screen; Pi kiosk setup; notes, meals, maintenance, inventory, bills, plans; weather; global search and reminders.
