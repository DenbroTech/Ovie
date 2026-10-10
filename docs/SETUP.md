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

## 4. Put Ovie online (GitHub Pages)

Ovie's address will be **https://denbrotech.github.io/Ovie/**. It talks straight to Supabase; GitHub only stores the app's files.

1. Open https://github.com/DenbroTech/Ovie → **Settings** → **Pages** (left side).
   Under **Build and deployment** → **Source**, choose **GitHub Actions**.
2. Still in Settings → **Secrets and variables** → **Actions** → the **Variables** tab → **New repository variable**. Add two:
   - Name `VITE_SUPABASE_URL`, value `https://vbncwfkkeqfgkiwcoiql.supabase.co`
   - Name `VITE_SUPABASE_PUBLISHABLE_KEY`, value your `sb_publishable_…` key (Supabase → Project Settings → API Keys)
3. Every change merged into `main` now publishes itself (repo → **Actions** tab shows progress, about 2 minutes). Open screens reload to the new version within about 5 minutes.

The repo must stay **public** for free GitHub Pages. Nothing secret is in it: the publishable key only allows what the database rules allow.

## 5. Raspberry Pi kiosk

See [PI.md](PI.md): one command on the Pi, then it starts into Ovie at every power-on, with "Switch to the desktop" in Settings.
