# Setting up Ovie

Commands are for Windows Command Prompt unless marked "Pi".

## 1. Supabase (one-time, in the dashboard)

1. **Apply the migrations** in `supabase/migrations/` (Claude applies them with the Supabase migration tool once you say go).
2. **Expose the `ovie` schema**: Project Settings → **Data API** → *Exposed schemas* → add `ovie` → **Save**.
   Leave everything else as it is. Until this is done, the app shows "The ovie schema isn't exposed…".
3. **Create the accounts**: Authentication → **Users** → *Add user* → *Create new user*, with *Auto Confirm User* ticked:
   - you
   - your partner
   - the kiosk (e.g. `kiosk@<your domain>`, with a long random password you keep in your password manager)

   Ovie has no public sign-up screen.

## 2. Run locally

```
copy .env.example .env.local
REM edit .env.local: set VITE_SUPABASE_PUBLISHABLE_KEY (Supabase → Project Settings → API Keys → publishable key)
npm install
npm run dev
```

## 3. First sign-in

1. Sign in as yourself and choose **Start a household**.
2. Go to Settings → **Invite a person**. Your partner signs in on their phone and enters the code.
3. Go to Settings → **Add a screen**. Sign the kiosk account in on the Pi and enter that code.

## 4. Deploy (Cloudflare Pages)

- Build command `npm run build`, output directory `dist`, Node 22.
- Environment variables (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `public/_headers` and `public/_redirects` are picked up automatically.

## 5. Kiosk (Pi)

These instructions come in the deployment phase, once the Pi's OS and model are confirmed. In short: Chromium starts on boot,
full screen, on the Pages URL, and stays signed in as the kiosk account.

## Backups

See `docs/BACKUPS.md`.
