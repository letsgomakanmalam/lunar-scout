@echo off
REM Double-click to save your work to GitHub now, without starting the site.
REM The live site updates about 2 to 3 minutes later.
cd /d "%~dp0"
call npm run sync
pause
