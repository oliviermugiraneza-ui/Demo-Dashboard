# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Install all deps (including devDeps for tsc)
COPY package*.json ./
RUN npm ci

# Compile TypeScript server → dist/server/
COPY tsconfig.json ./
COPY server/        ./server/
RUN npm run build:server

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled server output
COPY --from=builder /app/dist/ ./dist/

# Cloud Run requirements
ENV NODE_ENV=production
# PORT is injected by Cloud Run — do not hardcode
EXPOSE 8080

# Graceful startup — no shell, direct node for proper signal handling
CMD ["node", "dist/server/index.js"]
