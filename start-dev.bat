@echo off
REM Double-click to start the site. It first saves your work to GitHub (the live site
REM updates a few minutes later), then shows a QR code for your phone (same Wi-Fi).
cd /d "%~dp0"
REM Installs anything new in package.json, such as three.js for the 3D base (quick when nothing changed)
echo Checking packages...
call npm install --no-audit --no-fund
call npm run dev
pause
