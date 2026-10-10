@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM ---------------------------------------------------------------------------
REM  Ovie restore: puts the "ovie" schema back from a backup file.
REM  Usage:  scripts\restore-ovie.cmd backups\ovie-20261009-221500.dump
REM
REM  Safety: before touching anything it lists every object in the file and
REM  refuses to continue if ANY of them is outside the "ovie" schema, so it can
REM  never change Gryd's tables. The restore runs as one transaction: if anything
REM  fails, nothing is changed.
REM  It REPLACES all current Ovie data with what is in the backup.
REM ---------------------------------------------------------------------------
if "%~1"=="" (echo Usage: %~nx0 path\to\ovie-backup.dump & exit /b 1)
if not exist "%~1" (echo File not found: %~1 & exit /b 1)
if "%OVIE_DB_URL%"=="" (echo OVIE_DB_URL is not set. See docs\BACKUPS.md, step 2. & exit /b 1)
where pg_restore >nul 2>nul || (echo pg_restore not found. Install PostgreSQL 17 command line tools. & exit /b 1)
where psql >nul 2>nul || (echo psql not found. Install PostgreSQL 17 command line tools. & exit /b 1)

set LIST=%TEMP%\ovie-restore-list.txt
pg_restore --list "%~1" > "%LIST%" || (echo That file is not a valid Ovie backup. & exit /b 1)

REM Every real entry must name the ovie schema. Lines starting with ; are comments.
findstr /v /b /c:";" "%LIST%" | findstr /r /c:"[^ ]" | findstr /v /c:" ovie " > "%LIST%.bad"
for %%A in ("%LIST%.bad") do set BADSIZE=%%~zA
if not "!BADSIZE!"=="0" (
  echo These entries are NOT part of Ovie:
  type "%LIST%.bad"
  echo.
  echo REFUSING to restore: the file contains objects outside the ovie schema.
  exit /b 1
)
echo The backup contains only Ovie objects.

echo.
echo This will REPLACE all Ovie data with the contents of:
echo    %~1
set /p OK=Type RESTORE to continue: 
if /i not "!OK!"=="RESTORE" (echo Cancelled. Nothing was changed. & exit /b 1)

psql "%OVIE_DB_URL%" -v ON_ERROR_STOP=1 -q -f "%~dp0restore-pre.sql"
if errorlevel 1 (echo Could not prepare the restore. Nothing was changed. & exit /b 1)
pg_restore --dbname "%OVIE_DB_URL%" --clean --if-exists --no-owner --single-transaction --exit-on-error "%~1"
if errorlevel 1 (
  echo Restore FAILED and was rolled back. Ovie data is unchanged.
  echo Putting the photo permissions back...
  psql "%OVIE_DB_URL%" -v ON_ERROR_STOP=1 -q -f "%~dp0restore-fixups.sql"
  exit /b 1
)
psql "%OVIE_DB_URL%" -v ON_ERROR_STOP=1 -q -f "%~dp0restore-fixups.sql"
if errorlevel 1 (
  echo Data restored, but re-enabling live sync failed. Run this again:
  echo    psql "%%OVIE_DB_URL%%" -f scripts\restore-fixups.sql
  exit /b 1
)
echo Restore OK. Open Ovie and check your data.
endlocal
