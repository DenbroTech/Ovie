@echo off
REM Ovie restore: replaces the `ovie` schema with a backup made by ovie-backup.cmd.
REM It drops and recreates ONLY the `ovie` schema. It never touches Gryd (`public`).
REM
REM Usage: scripts\backup\ovie-restore.cmd backups\ovie-YYYYMMDD-HHMMSS.sql "postgresql://postgres.vbncwfkkeqfgkiwcoiql@HOST:5432/postgres"
setlocal
if "%~2"=="" (
  echo Usage: %~nx0 BACKUP_FILE "postgresql://postgres.vbncwfkkeqfgkiwcoiql@HOST:5432/postgres"
  exit /b 1
)
if not exist "%~1" (
  echo Backup file not found: %~1
  exit /b 1
)
REM Safety check: refuse a file that creates/changes/loads anything in public.
findstr /R /I /C:"^CREATE .* public\." /C:"^ALTER .* public\." /C:"^DROP .* public\." /C:"^COPY public\." /C:"^INSERT INTO public\." /C:"^TRUNCATE .*public\." "%~1" >nul
if not errorlevel 1 (
  echo REFUSING: this file contains statements for the public schema. It is not an Ovie-only backup.
  exit /b 1
)
echo This will DELETE all current Ovie data and replace it with %~1.
echo Gryd's data is not affected.
set /p CONFIRM=Type RESTORE to continue: 
if not "%CONFIRM%"=="RESTORE" (
  echo Cancelled.
  exit /b 1
)
psql "%~2" -v ON_ERROR_STOP=1 --single-transaction -c "drop schema if exists ovie cascade;" -f "%~1"
if errorlevel 1 (
  echo Restore FAILED. Nothing was changed: it ran in one transaction.
  exit /b 1
)
echo Restore complete.
endlocal
