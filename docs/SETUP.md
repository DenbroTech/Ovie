# Ovie setup

Do these in order. Nothing here needs the database password, a secret key, or any logins.

## 1. Supabase: expose the `ovie` schema (one-time, needed now)

1. Open https://supabase.com/dashboard/project/vbncwfkkeqfgkiwcoiql
2. Left sidebar → **Project Settings** (gear) → **Data API**.
3. Find **Exposed schemas**. Click the box and add **`ovie`**. Leave `public` and anything else exactly as it is.
4. Click **Save**.

Ovie's tables are still protected by row-level security: exposing the schema only lets devices that were linked with your home code reach your home's rows.

## 2. Supabase: turn on anonymous sign-ins (one-time, needed now)

Ovie has no logins. Each phone, PC or wall screen quietly gets its own private device identity, and you link it to your home **once** with the home code.

1. Left sidebar → **Authentication** → **Sign In / Providers** (may be called **Providers**).
2. Find **Allow anonymous sign-ins** and switch it **on**. Click **Save** if there is a Save button.
3. Leave every other setting alone.

₲ryd does not use Supabase Auth, so this does not affect it.

## 3. Set up your home (first device)

1. Open Ovie (on your PC first: see README → "Run it on your PC").
2. Ovie says "Hi, I'm Ovie!" → type the home name and your name → **Start**. (Tick "This is the shared wall screen" if you are doing this on the Pi.)
3. Open **Settings** → **Home code**. That code adds every other device.

## 3b. Add the other devices

On each phone or screen: open Ovie → type the **home code** → tap who the device is for (**Lina**, **Andrew**, **Someone new**, or **Wall screen**). Done for good on that device.

- Nobody can create a second home: anyone who finds the web address without the code sees only the code screen.
- Lost a phone? Settings → **Devices** → remove it. If you think the code leaked, Settings → **Home code** → make a new one (devices already set up keep working).
- Clearing a browser's data forgets that device. Just type the code again, and remove the old entry from Settings → Devices.

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
4. **Save and Deploy.** Then open the `…pages.dev` address on each device and add it with the home code.
5. Every push to `main` redeploys, and open screens reload to the new version within about 5 minutes (or straight away when the screen wakes or comes back online).

## 5. Raspberry Pi kiosk

Coming in a later phase, with exact commands for your Pi model and OS.
