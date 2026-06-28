@echo off
REM ============================================================
REM  Zernio autoposter - WATCH MODE
REM  Double-click this file to start watching your folder.
REM  Any new video dropped into ZERNIO_WATCH_DIR (set in
REM  zernio\.env) gets posted to Zernio as a draft.
REM  Leave this window open. Close it to stop watching.
REM ============================================================
cd /d "%~dp0\.."
echo Starting Zernio autoposter (watch mode)...
echo Press Ctrl+C or close this window to stop.
echo.
node zernio\autopost.mjs
echo.
echo Watcher stopped.
pause
