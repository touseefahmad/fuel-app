@echo off
REM Starts Fuel Stock Manager locally. No "npm install" needed - the backend
REM uses only Node.js built-in modules (http, node:sqlite, crypto).
cd /d "%~dp0backend"
echo Starting Fuel Stock Manager...
echo Open http://localhost:4000 in your browser once it says "running at".
echo.
node src\server.js
pause
