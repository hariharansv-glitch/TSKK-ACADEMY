#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TSKK Academy Platform — Local bootstrap.
# Prepares .env, brings up Docker services, runs migrations and seeds.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bootstrap]\033[0m %s\n' "$*" >&2; }

cd "${ROOT_DIR}"

if [[ ! -f .env ]]; then
  log "Creating .env from .env.example"
  cp .env.example .env
  warn "Fill in the .env file with production-safe secrets before deploying."
fi

log "Building images"
docker compose build

log "Starting infrastructure (postgres, redis, minio)"
docker compose up -d postgres redis minio
sleep 8

log "Bootstrapping MinIO buckets"
docker compose up minio-bootstrap

log "Installing backend dependencies"
docker compose run --rm backend pnpm install --frozen-lockfile

log "Generating Prisma client & running migrations"
docker compose run --rm backend pnpm exec prisma migrate deploy
docker compose run --rm backend pnpm exec prisma generate

log "Seeding database"
docker compose run --rm backend pnpm exec prisma db seed || warn "Seed step reported errors; check manually"

log "Starting the full stack"
docker compose up -d

log "Stack is up. Backend: http://localhost:4000/api/v1  •  Frontend: http://localhost:3000"
