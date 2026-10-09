@echo off
REM Ovie backup: exports ONLY the `ovie` schema (structure + data) from Supabase.
REM Gryd's tables in `public` are never read or written by this script.
REM
REM Needs: PostgreSQL 17 client tools (pg_dump, psql) on PATH.
REM Usage: scripts\backup\ovie-backup.cmd "postgresql://postgres.vbncwfkkeqfgkiwcoiql@HOST:5432/postgres"
REM   Copy the connection string from Supabase: Connect button -> Session pooler.
REM   Leave the password OUT of the string; pg_dump will ask for it.
setlocal
if "%~1"=="" (
  echo Usage: %~nx0 "postgresql://postgres.vbncwfkkeqfgkiwcoiql@HOST:5432/postgres"
  exit /b 1
)
if not exist backups mkdir backups
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set STAMP=%%i
set OUT=backups\ovie-%STAMP%.sql
pg_dump --schema=ovie --no-owner --format=plain --file="%OUT%" "%~1"
if errorlevel 1 (
  echo Backup FAILED.
  exit /b 1
)
echo Backup written to %OUT%
endlocal
