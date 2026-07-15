#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TSKK Academy Platform — Composite health check.
# Verifies that backend, frontend, postgres, redis and MinIO are reachable.
# Exits non-zero on any failure. Suitable for cron/uptime probes.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:4000/api/v1/health}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tskk-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-tskk-redis}"
MINIO_URL="${MINIO_URL:-http://localhost:9000/minio/health/live}"

status=0

check_http() {
  local name="$1"
  local url="$2"
  if curl -fsS -m 5 -o /dev/null "${url}"; then
    printf '✔ %-10s OK  %s\n' "${name}" "${url}"
  else
    printf '✘ %-10s FAIL %s\n' "${name}" "${url}"
    status=1
  fi
}

check_docker_exec() {
  local name="$1"
  local container="$2"
  shift 2
  if docker exec "${container}" "$@" > /dev/null 2>&1; then
    printf '✔ %-10s OK  %s\n' "${name}" "${container}"
  else
    printf '✘ %-10s FAIL %s\n' "${name}" "${container}"
    status=1
  fi
}

check_http     "backend"  "${BACKEND_URL}"
check_http     "frontend" "${FRONTEND_URL}"
check_http     "minio"    "${MINIO_URL}"
check_docker_exec "postgres" "${POSTGRES_CONTAINER}" pg_isready -U "${POSTGRES_USER:-tskk_admin}"
check_docker_exec "redis"    "${REDIS_CONTAINER}"    redis-cli ping

exit "${status}"
