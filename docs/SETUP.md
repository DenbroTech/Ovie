# Ovie setup

Do these in order. Nothing here needs the database password or a secret key.

## 1. Supabase: expose the `ovie` schema (one-time, needed now)

1. Open https://supabase.com/dashboard/project/vbncwfkkeqfgkiwcoiql
2. Left sidebar → **Project Settings** (gear) → **Data API**.
3. Find **Exposed schemas**. Click the box and add **`ovie`**. Leave `public` and anything else exactly as it is.
4. Click **Save**.

Ovie's tables are still protected by row-level security: exposing the schema only lets signed-in household members reach their own rows.

## 2. Supabase: allow Ovie's web address for login emails (when Ovie has an address)

Only needed once Ovie is on Cloudflare Pages (step 4), and only if email confirmation is switched on.

1. Left sidebar → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, click **Add URL** and add your Ovie address, e.g. `https://ovie.pages.dev/**`. Also add `http://localhost:5173/**` for testing on your PC.
3. Do **not** change the Site URL if ₲ryd or anything else uses it.

## 3. Create your logins

Open Ovie (on your PC first: see README → "Run it on your PC").

1. **Andrew:** Create account → email + password → **New household** → your name.
2. Open **Settings** and note the **invite code**.
3. **Lina:** on her phone, Create account → **Join with code** → the code → her name.
4. **Wall screen:** make a separate login for it (e.g. a `+kiosk` address such as `you+ovie-kiosk@gmail.com`). On the Pi: Create account → Join with code → tick **"This is the shared wall screen"**. It then stays signed in.

## 4. Cloudflare Pages (when you want it online)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick **DenbroTech/Ovie**.
2. Build settings:
   - Framework preset: **None** (or Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Environment variables** (Production and Preview):
   - `VITE_SUPABASE_URL` = `https://vbncwfkkeqfgkiwcoiql.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your `sb_publishable_…` key
   - `NODE_VERSION` = `22`
4. **Save and Deploy.** Every push to `main` redeploys, and open screens reload to the new version within about 5 minutes (or straight away when the screen wakes or comes back online).

## 5. Raspberry Pi kiosk

Coming in a later phase, with exact commands for your Pi model and OS.
