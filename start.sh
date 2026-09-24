#!/usr/bin/env bash
# Starts Fuel Stock Manager locally. Requires MongoDB running locally (or a
# MONGODB_URI pointing elsewhere) - see README.md for setup.
set -e
cd "$(dirname "$0")/backend"
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)..."
  npm install
  echo
fi
echo "Starting Fuel Stock Manager..."
echo "Open http://localhost:4000 in your browser once it says 'running at'."
echo
node src/server.js
