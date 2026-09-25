# Fuel Stock Manager - app image (backend + static frontend).
# MongoDB runs as its own separate container - see docker-compose.yml.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching - only re-runs npm
# install when package.json actually changes).
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

# Now copy the actual app code. backend/ and frontend/ must stay siblings
# inside the image, same as on disk - server.js finds the frontend folder
# via a relative "../../frontend" path from backend/src/server.js.
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

# Pre-create the data folder (holds the session-signing secret.key) so that
# when Compose mounts a named volume here, Docker seeds it with this
# ownership instead of defaulting the new volume to root.
RUN mkdir -p /app/backend/data && chown -R node:node /app

# Runs as the non-root "node" user baked into the official Node image,
# rather than root, as a basic container-security default.
USER node

ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/server.js"]
