# ── Stage 1: Build ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build‑time arguments (mirrored from clinic/frontend/Dockerfile)
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Install dependencies – copy from the actual frontend folder
COPY clinic/frontend/package.json clinic/frontend/package-lock.json ./
RUN npm ci

# Copy source code from the actual frontend folder and build
COPY clinic/frontend/ ./
RUN npm run build

# ── Stage 2: Run ────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy the built assets from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]