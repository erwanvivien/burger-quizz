# syntax=docker.io/docker/dockerfile:1
FROM node:22-alpine AS base

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
# Platform-specific Sharp for Alpine Linux
RUN npm install --cpu=x64 --os=linux --libc=musl sharp

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY app ./app
COPY lib ./lib
COPY public ./public
COPY server.ts \
  next.config.ts \
  tsconfig.json \
  package.json \
  package-lock.json ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Bundle custom server; socket.io and lib/* are inlined.
# next and sharp stay external — they resolve from node_modules at runtime.
RUN node_modules/.bin/esbuild server.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --outfile=server.js \
  --external:next \
  --external:sharp

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
