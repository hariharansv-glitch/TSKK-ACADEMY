# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# TSKK Backend — multi-stage Dockerfile
# stages: base → deps → development → build → production
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20-alpine

# ── base ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl chromium ca-certificates \
    freetype harfbuzz nss ttf-freefont \
  && corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# ── deps: install ALL deps (used by dev & build) ────────────────────────────
# The `pnpm-lock.yaml*` glob makes the lockfile optional — if it exists we get
# a reproducible install; if not, pnpm resolves from package.json. The cache
# mount preserves the pnpm store between builds so we don't re-download all
# ~900 packages every time (this was the other big time sink in CI).
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && if [ -f pnpm-lock.yaml ]; then \
        pnpm install --frozen-lockfile --prefer-offline; \
    else \
        pnpm install --prefer-offline; \
    fi

# ── development: hot-reload container used by docker-compose ────────────────
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Normalise CRLF → LF in case the script was authored on Windows, then
# mark it executable. Prisma generate is done here (dev image), not at
# runtime, so container starts are fast.
RUN sed -i 's/\r$//' /app/scripts/docker-entrypoint.sh \
 && chmod +x /app/scripts/docker-entrypoint.sh \
 && pnpm prisma generate
EXPOSE 4000 9229
# The entrypoint runs `prisma db push` + `prisma db seed` once, then execs
# the CMD (`pnpm start:dev`) so Nest becomes PID 1.
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["pnpm", "start:dev"]

# ── build: compile TS → JS ──────────────────────────────────────────────────
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build && pnpm prune --prod

# ── production: minimal runtime image ───────────────────────────────────────
FROM node:${NODE_VERSION} AS production
RUN apk add --no-cache libc6-compat openssl chromium ca-certificates \
    freetype harfbuzz nss ttf-freefont dumb-init \
  && corepack enable && corepack prepare pnpm@9.12.0 --activate \
  && addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nestjs
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app

COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
