# Ovie — kickoff decisions (these override docs/BRIEF.md where they conflict)

The product brief is `docs/BRIEF.md`. The decisions in THIS section override it wherever they conflict.

**The app is called Ovie.** The master prompt calls it "Home Hub"; read every mention of "Home Hub" there as Ovie, and use Ovie in the UI, the docs and the PWA manifest.

## Before you start, check access
1. Run Supabase `list_projects`. You should see ₲ryd (ref `vbncwfkkeqfgkiwcoiql`). If you don't, stop and tell me: the connector is on the wrong account.
2. Check that this session can reach `vbncwfkkeqfgkiwcoiql.supabase.co`. If the network blocks it, tell me to allow it.
3. Never ask me for the database password, and never put it or any service-role key in code, Git or chat.
4. Work in the repo `DenbroTech/Ovie` (https://github.com/DenbroTech/Ovie). It already exists; if it isn't attached to this session, attach it. Don't create another repo.

## Architecture overrides (agreed already, don't reopen them)
- **No Node/Express server and no SQLite on the Pi.** The backend is my EXISTING ₲ryd Supabase project (ref `vbncwfkkeqfgkiwcoiql`, URL `https://vbncwfkkeqfgkiwcoiql.supabase.co`, region ap-southeast-2). Do NOT create a new Supabase project.
- **Everything Ovie owns goes in its own Postgres schema, `ovie`.** That covers tables, functions, triggers, policies and storage buckets prefixed `ovie-`. Create nothing in `public`, and alter nothing ₲ryd owns. Expose `ovie` to the Data API: if that needs a dashboard setting (Settings → Data API → Exposed schemas), tell me exactly what to click. Don't change any other setting without asking.
- **The frontend uses the project's publishable key**, which I'll put in a `.env` / Cloudflare Pages env var, not committed. Check `get_publishable_keys`.
- **Frontend:** React + TypeScript + Vite, deployed to Cloudflare Pages as a static PWA. When a new version is deployed, reload to it straight away (network-first app shell, no stale cached builds).
- **The Raspberry Pi is only a kiosk.** It runs Chromium full-screen on the Cloudflare Pages URL and starts automatically on boot. Phones use the same URL from anywhere.
- **Internet is required.** I accept this, so drop the master prompt's offline-first and local-server requirements. Show a clear "offline / reconnecting" state, and use Supabase Realtime so all devices stay in sync.
- **Auth:** real Supabase Auth logins for the two of us (email + password), with the household data model from the brief (households, members, roles) enforced by RLS on every `ovie` table. Every policy requires a signed-in household member, so there are no anon policies on Ovie data. The kiosk stays signed in as a household device, so it never asks for a password. Before adding auth, check that ₲ryd doesn't already rely on auth settings or triggers on `auth.users` that new sign-ups would trip, and tell me what you find.
- **Migrations:** apply them through the Supabase migration tool, named with a `ovie_` prefix, and keep the same SQL under `supabase/migrations/` in the repo. Every migration must only touch the `ovie` schema; review each one for that before applying it.
- **Backups:** document Supabase's backup situation honestly and provide a scripted export/restore of the `ovie` schema only (`pg_dump --schema=ovie`), which I run with my own password from my PC. The restore must never touch ₲ryd's tables.

## ₲ryd (the `public` schema in the same project): READ ONLY, do not modify
₲ryd is my personal finance app: a single `index.html` on Cloudflare Pages, with 22 tables in `public`, all with an anon full-access policy:
`accounts`, `transactions`, `categories`, `wages`, `transfers`, `holdings`, `valuations`, `balance_checks`, `budgets`, `settings`, `favorites`, `tax_deductions`, `trips`, `house_tx`, `house_people`, `debtors`, `debt_items`, `debt_payments`, `leave_days`, `leave_plan`, `monthly_summary`, `audit_log`.
- **Never** run DDL, inserts, updates, deletes or trigger changes against anything in `public`, and never change its RLS policies, even though they're wide open (tell me about that separately; don't fix it). Never touch the unrelated project "Gryd" (ref `qdvoceqhiumsivpimlkd`) at all.
- ₲ryd's Postgres triggers own all balance maths, and `audit_log` records every write. That's why Ovie must never write to ₲ryd.
- Months are stored as names ("August"), not numbers, so sort them in code.

## Casa panel (₲ryd's household finances shown inside Ovie)
- Show ₲ryd's "casa" data, the tables `house_tx` and `house_people`, as a read-only Ovie section plus a dashboard card.
- Read it through read-only objects in the `ovie` schema: a `security definer` function or views that SELECT from `public.house_tx` / `public.house_people`, and that only signed-in household members can call. Ovie's frontend never queries `public` tables directly.
- First inspect those two tables (columns and a few sample rows, read-only), then propose what the panel shows (for example, this month's shared spend, who owes whom, recent house transactions) before you build it.
- If the casa read fails (for example, ₲ryd renames a column), the panel shows an honest error and the rest of Ovie keeps working.

## Order of work
Phase A, briefly (schema, API boundaries via RLS/RPC, navigation, design tokens). Then build in this order:
1. Foundation (project, auth, household, settings, shell).
2. Dashboard.
3. Tasks and recurring jobs.
4. Shopping lists.
5. Calendar.
6. TV/film tracker.
7. Casa panel.

Use Postgres functions and transactions for multi-record operations, such as completing a recurring task (idempotent, no duplicate next occurrences) or transferring recipe ingredients to the shopping list. Test them (SQL/RPC tests plus frontend tests), and run Supabase security advisors after every schema change.

At the end of each phase, report what was built, which files changed, the real test results, how to run it, and what's left. Commit and push to the session branch; open a PR only if I ask.

Terminal commands for me: Windows Command Prompt unless I say I'm on the Pi.

---
