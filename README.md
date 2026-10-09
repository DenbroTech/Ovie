# Ovie 🐑

A household hub (tasks, shopping, calendar, TV tracking and more) for a framed Raspberry Pi touchscreen and our phones. Ovie the sheep is the mascot.

- Product brief: [docs/BRIEF.md](docs/BRIEF.md)
- Agreed architecture decisions: [docs/KICKOFF.md](docs/KICKOFF.md) — these win where the two disagree.
- Plan (schema, navigation, design): [docs/PLAN.md](docs/PLAN.md)
- Setup steps (Supabase, PC, Cloudflare Pages): [docs/SETUP.md](docs/SETUP.md)
- Backups: [docs/BACKUPS.md](docs/BACKUPS.md)
- Progress and what's left: [docs/STATUS.md](docs/STATUS.md)

## How it fits together

- **App:** React + TypeScript + Vite, a static PWA hosted on Cloudflare Pages.
- **Data:** the existing ₲ryd Supabase project, in its own `ovie` schema.
- **No logins.** Each device is linked once with the home code. Every table has row-level security, so only linked devices can see or change anything. You can still edit data directly in the Supabase dashboard.
- **Wall screen:** the Raspberry Pi runs Chromium full screen on the same web address. Phones use the same address.
- **Internet is required.** When it drops, Ovie shows "Offline — reconnecting" and pauses changes.

## Run it on your PC (Windows Command Prompt)

You need Node.js 22 LTS (22.12 or newer) from https://nodejs.org.

```
cd path\to\Ovie
copy .env.example .env
notepad .env
```

In Notepad, paste the publishable key (Supabase → Project Settings → API Keys → "Publishable key", starts with `sb_publishable_`), then save. Then:

```
npm ci
npm run dev
```

Open http://localhost:5173. Other devices on your Wi-Fi can use the "Network" address that `npm run dev` prints.

## Checks

```
npm test            (frontend tests)
npm run typecheck   (TypeScript)
npm run build       (production build into dist\)
```

Database tests live in `supabase/tests/`. `supabase/tests/local/run.sh` runs every migration and SQL test against a throwaway local Postgres, and `backup_restore.sh` tests the backup scripts. Neither ever touches the real project.

## Folders

```
src/                 the app (app/ shell, components/, features/<module>/, lib/, styles/)
public/              icons, manifest, service worker, Cloudflare _headers/_redirects
supabase/migrations  every database change, exactly as applied (all named ovie_*)
supabase/tests       SQL tests (always rolled back)
scripts/             backup-ovie.cmd / restore-ovie.cmd (ovie schema only)
docs/                brief, kickoff, plan, setup, backups, status
```
