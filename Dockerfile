# syntax=docker/dockerfile:1

# ---------- base ----------
FROM node:24-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------- deps: install node_modules once ----------
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---------- builder: generate Prisma client + build Next.js ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders so modules can load during the build. Real values are only
# provided at runtime and are never baked into the image.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-runtime" \
    BETTER_AUTH_URL="http://localhost:3000"
RUN npm run build

# ---------- migrate: one-off job that applies Prisma migrations ----------
FROM base AS migrate
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- runner: minimal production image ----------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1
CMD ["node", "server.js"]
