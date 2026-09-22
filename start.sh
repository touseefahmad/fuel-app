#!/usr/bin/env bash
# Starts Fuel Stock Manager locally. No "npm install" needed - the backend
# uses only Node.js built-in modules (http, node:sqlite, crypto).
set -e
cd "$(dirname "$0")/backend"
echo "Starting Fuel Stock Manager..."
echo "Open http://localhost:4000 in your browser once it says 'running at'."
echo
node src/server.js
