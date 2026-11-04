@echo off
REM Double-click to start the site. It first saves your work to GitHub (the live site
REM updates a few minutes later), then shows a QR code for your phone (same Wi-Fi).
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages, this happens once...
  call npm install
)
call npm run dev
pause
