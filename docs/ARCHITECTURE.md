# Ovie architecture (Phase A)

Read alongside `docs/KICKOFF.md`, which overrides `docs/BRIEF.md`.

## Shape

```
Phones ─┐
        ├─ HTTPS ─> Cloudflare Pages (static React PWA) ──> Supabase project ₲ryd
Pi kiosk┘            network-first app shell                 ├─ schema ovie   (Ovie: RLS on every table)
                                                             ├─ schema public (₲ryd: READ ONLY to Ovie)
                                                             ├─ Auth (email + password)
                                                             └─ Realtime (live sync between devices)
```

- No server of our own. The browser talks to Supabase with the **publishable key**. Rows are protected by
  RLS policies in `ovie`, and every policy requires a signed-in household member. `anon` has no access to `ovie`.
- Multi-row operations, such as creating a household, redeeming an invite, completing a recurring task
  or moving recipe ingredients to the list, are Postgres functions (`ovie.*`) that run in one transaction.
- ₲ryd's `public` tables are never written. The Casa panel (step 7) will read `house_tx`/`house_people`
  through read-only `security definer` functions in `ovie`.

## Data model (foundation, migration `ovie_foundation`)

| Table | Purpose |
|---|---|
| `ovie.households` | name, IANA timezone (drives "today", due dates, recurrence) |
| `ovie.household_members` | (household, user) → role `owner` / `member` / `device`, display name, colour token |
| `ovie.household_invites` | single-use 8-character codes, which expire after 7 days. Only owners see them |
| `ovie.household_settings` | per-household settings (week start, small prefs JSON) |
| `ovie.member_settings` | per-person or per-screen settings (theme, prefs JSON) |

RPCs: `create_household`, `create_invite`, `accept_invite`. RLS helpers are `is_member` and `has_role`.
These are `security definer` with an empty `search_path`, and they only ever answer about `auth.uid()`.

Roles:
- **owner** manages members, invites and the household's name and timezone.
- **member** is a person with full use of the household data.
- **device** is the kiosk. It uses household data but can't manage people or household settings.
  It's a real Supabase Auth user whose session persists in the kiosk browser, so the screen never asks for a password.

Later modules (tasks, shopping, calendar, watch) each get their own migration. Every table gets a `household_id`,
RLS through `ovie.is_member(household_id)`, and is added to the Realtime publication.

## Frontend

- `src/lib`: Supabase client (schema `ovie`), config, errors, theme, time, connection status, and SW registration.
- `src/auth`, `src/household`: session, plus the loaded household context (household, me, members, settings).
- `src/ui`: the design-system components (Button, Card, TextField, Segmented, Avatar, States, Toast,
  ConfirmDialog, ConnectionBanner). They use only the tokens in `src/styles/tokens.css`.
- `src/shell`: navigation. It's a left rail at ≥900px (kiosk/desktop) and a bottom tab bar on phones.
- `src/pages`: the screens. Unbuilt sections show an honest "not built yet" state with no controls.

### Navigation
Today · Tasks · Shopping · Calendar · Watch · Casa · Settings. On phones it's Today · Tasks · Shopping · Calendar · More.

### Design tokens
They give a warm paper background, a sage accent, Inter for the UI and Fraunces for display headings.
Corners are 8/14/20px with restrained shadows, and touch targets are at least 48px (56px for primary actions).
Light and dark themes are both defined. The theme can follow the system or be set per account.
Six member colours (sage, clay, sky, plum, ochre, slate) each have a foreground/soft pair tuned for both themes.

### Updates and offline
- `public/sw.js` serves the HTML network-first, so a deploy shows up on the next load. Hashed `/assets/*` files are cache-first.
- A new service worker takes over at once, and the page reloads onto it.
- The kiosk also checks for updates every 5 minutes and whenever it becomes visible.
- `public/_headers` stops Cloudflare caching `index.html`/`sw.js`.
- Offline: the last shell loads, and a banner reads "Offline" or "Reconnecting". It's driven by `navigator.onLine` and the Realtime socket state.

## Testing
- `npm test` runs Vitest component and logic tests against a fake Supabase client.
- `npm run test:db` applies all migrations to a throwaway local Postgres with a small Supabase stub
  (`anon`/`authenticated` roles, `auth.uid()`), then runs `supabase/tests/*.test.sql`. That covers RLS, grants and RPCs. It never touches the real project.
- `npm run test:backup` round-trips the ovie-only backup/restore locally.
