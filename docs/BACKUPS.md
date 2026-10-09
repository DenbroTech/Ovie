# Ovie backups

## The honest situation

- Ovie's data lives in the ₲ryd Supabase project, which is on the **free plan**.
- Check **Dashboard → Database → Backups** to see what your plan offers today. On the free plan you should not count on having any backup you can restore yourself.
- Even on paid plans, Supabase's own restore puts back the **whole project**. That would also roll back ₲ryd's finance data, so it is the wrong tool for "undo Ovie".
- So Ovie has its own backup, which copies **only** the `ovie` schema. You run it from your PC with your own database password. The password is typed when asked and is never saved in Ovie, in Git or in chat.

Free-plan note: Supabase pauses free projects after a period with no activity. The wall screen keeps Ovie (and ₲ryd) active, but if it is off for a long time, check the dashboard.

## One-time setup (Windows)

1. Install the **PostgreSQL 17** command-line tools: https://www.postgresql.org/download/windows/ → "Download the installer" → in the installer tick only **Command Line Tools**. (Use 17 or newer: the project runs Postgres 17.)
2. Add them to PATH for this window (adjust the version folder if different):
   ```
   set PATH=%PATH%;C:\Program Files\PostgreSQL\17\bin
   ```
3. In the Supabase dashboard click **Connect** (top bar) → **Session pooler** → copy the URI. Remove the `:[YOUR-PASSWORD]` part so it looks like
   `postgresql://postgres.vbncwfkkeqfgkiwcoiql@aws-…pooler.supabase.com:5432/postgres`, then:
   ```
   setx OVIE_DB_URL "postgresql://postgres.vbncwfkkeqfgkiwcoiql@aws-...pooler.supabase.com:5432/postgres"
   ```
   Close and reopen Command Prompt afterwards.

## Make a backup

```
cd path\to\Ovie
scripts\backup-ovie.cmd
```

Type the database password when asked. The file lands in `backups\ovie-YYYYMMDD-HHMMSS.dump`. The `backups` folder is ignored by Git. Copy it somewhere safe (OneDrive, a USB stick). A weekly backup is plenty to start with.

## Restore a backup

```
scripts\restore-ovie.cmd backups\ovie-20261009-221500.dump
```

What it does, in order:

1. Lists everything inside the file and **refuses** if anything is outside the `ovie` schema, so it cannot change ₲ryd.
2. Asks you to type `RESTORE`.
3. Replaces Ovie's tables, data, functions and policies in **one transaction**. If anything fails, nothing changes.
4. Re-enables live sync for Ovie's tables (`scripts\restore-fixups.sql`).

Limits:
- Restore into the same version of Ovie the backup came from. If newer Ovie tables exist that are not in the backup, the restore stops safely and changes nothing.
- Logins (email and password) belong to Supabase Auth, not to Ovie, so they are not part of this backup.

## How it was tested

`supabase/tests/local/backup_restore.sh` runs the same `pg_dump` / `pg_restore` commands and the same safety check against a throwaway local Postgres that has a fake ₲ryd table with an audit trigger:
- back up → damage Ovie's data → restore
- Ovie's data comes back exactly
- the fake ₲ryd table and its audit log are unchanged
- live sync is restored
- a backup containing other schemas is refused
