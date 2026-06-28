@echo off
REM ============================================================
REM  Zernio autoposter - FIRST-TIME SETUP
REM  Double-click this once. It asks for your API key and the
REM  folder to watch, then writes zernio\.env for you.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo   ===== Zernio autoposter setup =====
echo.
set "KEY="
set /p KEY="Paste your Zernio API key (it starts with sk_) and press Enter: "
if "%KEY%"=="" (
  echo No key entered. Run this again and paste your key.
  pause
  exit /b
)
echo.
set "DIR="
set /p DIR="Paste the folder to watch (e.g. C:\Users\chris\Videos\Captures): "
if "%DIR%"=="" (
  echo No folder entered. Run this again and paste the folder path.
  pause
  exit /b
)

> .env echo ZERNIO_API_KEY=%KEY%
>> .env echo ZERNIO_WATCH_DIR=%DIR%
>> .env echo ZERNIO_PLATFORMS=instagram,tiktok
>> .env echo ZERNIO_TIKTOK_PRIVACY=PUBLIC_TO_EVERYONE
>> .env echo ZERNIO_STABLE_MS=3000

echo.
echo   Saved your settings to zernio\.env
echo   You can now double-click run-watcher.bat to start.
echo.
pause
endlocal
