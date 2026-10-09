# Backups

## What Supabase gives you
- What you get depends on the plan. Open Database → **Backups** in the dashboard to see what ₲ryd's plan includes.
  As of writing, the Free plan has no self-service restore, and paid plans have daily backups (7+ days) plus optional point-in-time recovery.
- Any dashboard restore rolls back the **whole project**, which includes ₲ryd. It's not a way to undo an Ovie mistake.
- So keep your own Ovie-only exports, below.

## Ovie-only export and restore (run from your PC)

You need the PostgreSQL 17 client tools (`pg_dump`, `psql`). The connection string comes from Supabase → **Connect** → *Session pooler*.
Leave the password out of the string, and the tool will ask for it. The password is never stored in a script or in Git.

```
scripts\backup\ovie-backup.cmd "postgresql://postgres.vbncwfkkeqfgkiwcoiql@<pooler host>:5432/postgres"
```
This writes `backups\ovie-YYYYMMDD-HHMMSS.sql`, which contains the `ovie` schema only. `backups/` is git-ignored.

```
scripts\backup\ovie-restore.cmd backups\ovie-YYYYMMDD-HHMMSS.sql "postgresql://postgres.vbncwfkkeqfgkiwcoiql@<pooler host>:5432/postgres"
```
The restore works like this:
- It refuses a file that contains statements for `public`.
- It asks you to type `RESTORE`.
- Then, in **one transaction**, it drops the `ovie` schema and reloads it from the file. If anything fails, nothing changes.
- ₲ryd's tables are never touched.

Note: Ovie rows reference Supabase Auth users. Restoring into the same project is fine. Restoring into a different project needs the same users to exist there first.

Tested by `npm run test:backup`, which uses the same pg_dump/psql commands on a throwaway database.
