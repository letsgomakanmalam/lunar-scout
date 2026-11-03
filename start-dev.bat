@echo off
REM Double-click to start the site. A QR code appears for your phone (same Wi-Fi).
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages, this happens once...
  call npm install
)
call npm run dev
pause
