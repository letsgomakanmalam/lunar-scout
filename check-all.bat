@echo off
REM Double-click to type-check, test and build, the same checks GitHub runs.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run check
pause
