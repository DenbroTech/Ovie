@echo off
setlocal EnableExtensions
REM ---------------------------------------------------------------------------
REM  Ovie backup: exports ONLY the "ovie" schema (tables, data, functions,
REM  policies) from Supabase into backups\ovie-YYYYMMDD-HHMMSS.dump
REM  It never reads or writes Gryd's tables in "public".
REM
REM  Needs: PostgreSQL 17 client tools (pg_dump) on your PATH.
REM  Needs: OVIE_DB_URL set to the "Session pooler" connection string from
REM         Supabase (Connect button), WITHOUT the password. pg_dump asks for it.
REM ---------------------------------------------------------------------------
if "%OVIE_DB_URL%"=="" (
  echo OVIE_DB_URL is not set. See docs\BACKUPS.md, step 2.
  exit /b 1
)
where pg_dump >nul 2>nul || (echo pg_dump not found. Install PostgreSQL 17 command line tools. See docs\BACKUPS.md. & exit /b 1)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set STAMP=%%i
if not exist "%~dp0..\backups" mkdir "%~dp0..\backups"
set OUT=%~dp0..\backups\ovie-%STAMP%.dump

echo Backing up the ovie schema to %OUT%
pg_dump "%OVIE_DB_URL%" --schema=ovie --format=custom --no-owner --file "%OUT%"
if errorlevel 1 (
  echo Backup FAILED. Nothing was changed in the database.
  if exist "%OUT%" del "%OUT%"
  exit /b 1
)
echo Backup OK: %OUT%
endlocal
