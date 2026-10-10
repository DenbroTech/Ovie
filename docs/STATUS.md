# Ovie status

## Done: Phase A (plan) + 1. Foundation

- `ovie` schema in the ₲ryd project: `households` (only one can exist), `members` (people), `devices` (paired phones/PCs/wall screen). RLS on all three: only paired devices get in, and there are no anon policies. RPCs: `setup_state`, `setup_household`, `people_for_code`, `pair_device`, `regenerate_invite_code`, `touch_device`. Realtime for Ovie tables.
- App, no logins: first run sets up the home; every other device types the home code once and taps who it is for (or "Wall screen"). Home (clock, date, greeting from Ovie the sheep, app grid). Settings: this device (who uses it, theme, remove), people (add/edit/remove, colours), home (name, time zone, home code), devices (last used, remove a lost phone).
- Pages slide in and out; offline banner; changes paused while offline; friendly error messages.
- PWA: manifest, Ovie icons, network-first service worker, automatic reload after a deploy.
- Backup/restore scripts for the `ovie` schema only, with a safety check.

## Waiting on you

- Nothing right now.

## Done: core apps

- **Home:** today at a glance (what's on, jobs due, things to buy) and live counts on the app icons.
- **Tasks:** quick add; who (a person or anyone); due date; important; repeats (daily, weekly, fortnightly, monthly, every 3 months). Ticking a repeating job schedules the next one exactly once, even if ticked twice or undone and redone. Done list with undo.
- **Shopping:** Groceries, Household and Hardware lists, plus your own. Fast add with quantity; tap to tick; "in the trolley"; clear ticked; "buy again" from what you've bought before. No accidental duplicates.
- **Calendar:** coming-up list and month view. All-day events; weekly, monthly and yearly repeats (birthdays on 29 Feb and the 31st handled); who; where; notes.
- **Watch:** shows and films. Progress kept separately for "together" and for each person. One-tap "Watched S1 E5", undo, tap episodes to correct them, mark a whole season. No episode descriptions, so no spoilers.
- **Finances:** read-only from ₲ryd: this month's house spending by category, what each person paid in (with their share), and recent transactions. Earlier months are one tap away.

## Known limits

- Editing a repeating calendar event changes every repeat (no "just this one" yet).
- Removing a person deletes their individual viewing history (their "together" history stays).
- Finances refreshes every 5 minutes while open (₲ryd changes don't push live to Ovie).

## Next

Your redesign pass, then: screensaver, Pi kiosk setup, notes, meals, reminders.

## Later

Screensaver for the wall screen; Pi kiosk setup; notes, meals, maintenance, inventory, bills, plans; weather; global search and reminders.
