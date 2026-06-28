@echo off
REM ============================================================
REM  Zernio autoposter - POST ONE VIDEO
REM  DRAG A VIDEO FILE onto this .bat to post it as a draft.
REM  (Or double-click and it will tell you what to do.)
REM ============================================================
cd /d "%~dp0"
if "%~1"=="" (
  echo.
  echo   To post a video: drag the video file onto this .bat icon.
  echo.
  pause
  exit /b
)
echo Posting "%~1" as a Zernio draft...
echo.
node autopost.mjs --once "%~1"
echo.
pause
