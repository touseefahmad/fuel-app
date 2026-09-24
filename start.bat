@echo off
REM Starts Fuel Stock Manager locally. Requires MongoDB running locally (or a
REM MONGODB_URI pointing elsewhere) - see README.md for setup.
cd /d "%~dp0backend"
if not exist node_modules (
  echo Installing dependencies ^(first run only^)...
  call npm install
  echo.
)
echo Starting Fuel Stock Manager...
echo Open http://localhost:4000 in your browser once it says "running at".
echo.
node src\server.js
pause
