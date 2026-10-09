# Ovie — Phase A plan

Short and practical. `docs/KICKOFF.md` wins over `docs/BRIEF.md`; this file records how both are being built.

## Architecture

```
 Pi kiosk (Chromium, full screen) ─┐
 Phones / laptops (any network)  ──┼──▶  Cloudflare Pages (static React PWA)
                                   │            │  supabase-js (publishable key + user JWT)
                                   │            ▼
                                   └──▶  Supabase project ₲ryd (vbncwfkkeqfgkiwcoiql)
                                          ├─ schema ovie      ← everything Ovie owns (RLS on every table)
                                          ├─ schema public    ← ₲ryd, READ ONLY via ovie.casa_* definer functions
                                          ├─ schema periodical← another app, never touched
                                          ├─ Auth             ← anonymous device sessions (no logins)
                                          └─ Realtime         ← live sync between devices
```

- No custom server. Business rules that touch several rows live in Postgres functions (`ovie.*` RPCs) so they are transactional and idempotent.
- Internet is required (agreed). The UI shows an "Offline – reconnecting" banner and disables writes while offline instead of pretending to work.
- Service worker is **network-first** for the app shell and checks `/version.json`; a new deploy reloads every open screen (including the kiosk) automatically.

## Repository layout

```
src/                React + TypeScript app
  app/              shell, routing, auth + household context, nav
  components/       reusable UI (Button, Card, Field, Dialog, EmptyState…)
  features/<name>/  one folder per module (settings, dashboard, tasks…)
  lib/              supabase client, helpers (dates, recurrence…)
  styles/           design tokens + base styles
public/             manifest, icons, service worker, Cloudflare _headers/_redirects
supabase/migrations ovie_* SQL (identical to what is applied through the migration tool)
supabase/tests      SQL tests (run in a rolled-back transaction)
scripts/            backup / restore of the ovie schema (Windows .cmd)
docs/               brief, kickoff, plan, setup guides
```

## Data model (core release)

All tables in `ovie`, all with `household_id`, RLS on, policies for the `authenticated` role only (no anon).

| Area | Tables | Notes |
|---|---|---|
| Foundation | `households`, `members`, `devices` | `members` = people (who tasks are assigned to). `devices` = paired phones/PCs/wall screen, each an anonymous Supabase user, linked to a person or shared. Only one household can exist (closed system). |
| Tasks | `task_lists`, `tasks` | `assignee` = member id, `shared` flag, priority, due/start dates, recurrence (`rrule`-lite: every N days/weeks/months), `completed_at` + `completed_by`. Completing a recurring task inserts the next occurrence through `ovie.complete_task()`, guarded by a unique `(series_id, due_on)` index so retries never duplicate. |
| Shopping | `shopping_lists`, `shopping_items` | Tap to tick (`checked_at`, `checked_by`), clear completed = archive, frequent/recent items come from history. |
| Calendar | `events`, `event_exceptions` | Events stored with timezone; recurring series expanded in the client; editing "this occurrence" writes an exception row, never touches the series. |
| Watch | `media_titles`, `seasons`, `episodes`, `viewings` | `viewings(episode/title, viewer_kind = member \| together, member_id)` — individual and shared progress are separate rows, never inferred. |
| Casa | (no tables) | `ovie.casa_*()` security-definer read-only functions over `public.house_tx` / `public.house_people`. |

Later modules (notes, meals, maintenance, inventory, bills, plans) follow the same pattern.

## API boundaries

- **Plain table access through RLS** for simple create/edit/delete (`is_member(household_id)` on every policy).
- **RPCs** for anything that spans rows or needs rules: `setup_household`, `pair_device`, `people_for_code`, `complete_task`, `uncomplete_task`, `mark_episodes`, `casa_summary`…
- Every function is `security definer` only where it must be, with `set search_path = ''` and an explicit membership check.
- The frontend never queries `public.*`.

## Navigation — "super simple, like apps"

- **Home** is like a phone home screen: the time, a greeting from **Ovie the sheep** (mascot and logo), the dashboard cards, and a grid of big app icons.
- Tap an icon → that app **slides in** from the right. The back arrow (or Home) slides it back out. No menus, no rails, no hidden drawers.
- Apps appear on the grid only once they are built, so there are no dead buttons.

Apps: Tasks · Shopping · Calendar · Watch · Casa · Settings

- **Screensaver** (later): after the kiosk is idle it shows a calm, slow view of "your stuff" (today, next event, shopping count, Ovie). Not built yet.

## Design system

Calm and warm: off-white paper / deep warm charcoal, one sage accent, clay for attention, soft red only for real errors. Rounded, friendly type (Nunito) to match Ovie. Tokens are CSS variables in `src/styles/tokens.css` (colour, spacing on a 4px scale, radius, shadow, type scale). Touch targets ≥ 48px, 56px on the kiosk. Light, dark and "follow system" themes.

## Roadmap

1. Foundation: project, auth, household, settings, shell, PWA, backup scripts.
2. Dashboard.
3. Tasks and recurring jobs.
4. Shopping lists.
5. Calendar.
6. TV and film tracker.
7. Casa panel (proposal first).

## Hardware

- **Wall screen (confirmed):** Jaycar XC9026: 7", 1024×600, HDMI, USB 5-point capacitive touch. About 15 cm wide (~170 px per inch), so the wall layout uses larger text (clock ~112 px, body ~21 px) and targets of at least 64 px (~1 cm). The home screen fits in one view with no scrolling.
- **Raspberry Pi:** Pi 4 Model B (confirmed). Plan: a fresh SD card with Raspberry Pi OS 64-bit (desktop), hostname `ovie`, SSH on. The old card (cat game) is kept untouched. Screen HDMI → micro-HDMI port 0, touch via USB. If the screen does not come up at 1024×600, add `video=HDMI-A-1:1024x600@60` to `cmdline.txt`. Kiosk autostart is written once Ovie has its Cloudflare Pages address.
- **Roles:** the wall screen is the main daily display. Phones and the website are the quick way to add and update things.

## Assumptions (reversible)

- Household timezone is taken from the browser when the household is created (editable in Settings).
- **No logins (decided 2026-10-09, replaces KICKOFF's "email + password").** Every device signs in anonymously and is paired once with the home code. RLS still requires a paired device on every table, so the public web address and publishable key alone give access to nothing. On the wall screen, actions are attributed by tapping who did them.
- Exactly one household (closed system): `setup_household` only works on the very first run.
