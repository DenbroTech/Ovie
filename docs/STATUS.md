# Ovie status

## Done: Phase A (plan) + 1. Foundation

- `ovie` schema in the ₲ryd project: `households`, `members` (roles owner / adult / device), RLS on both, RPCs `create_household`, `join_household`, `regenerate_invite_code`. No anon access. Realtime enabled for Ovie tables.
- App: sign in / create account, create or join a household (invite code; the wall screen joins as a "device"), Home (clock, date, greeting from Ovie the sheep, app grid), Settings (your name, colour, light/dark/automatic theme; household name, time zone, invite code, members; sign out).
- Pages slide in and out; offline banner; changes paused while offline; friendly error messages.
- PWA: manifest, Ovie icons, network-first service worker, automatic reload after a deploy.
- Backup/restore scripts for the `ovie` schema only, with a safety check.

## Waiting on you

- Expose the `ovie` schema (docs/SETUP.md, step 1). Until then sign-in works but the household screens show "The database is not ready yet".

## Next

2. Dashboard → 3. Tasks and recurring jobs → 4. Shopping → 5. Calendar → 6. Watch → 7. Casa (proposal first).

## Later

Screensaver for the wall screen; Pi kiosk setup; notes, meals, maintenance, inventory, bills, plans; weather; global search and reminders.
