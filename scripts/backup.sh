#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TSKK Academy Platform — Nightly backup script.
# Backs up Postgres and MinIO object storage. Retains the last N days.
# Recommended cron:
#   0 2 * * * /opt/tskk-academy/scripts/backup.sh >> /var/log/tskk-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tskk}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${BACKUP_ROOT}/${STAMP}"

DB_CONTAINER="${DB_CONTAINER:-tskk-postgres}"
DB_USER="${POSTGRES_USER:-tskk_admin}"
DB_NAME="${POSTGRES_DB:-tskk_academy}"

MINIO_CONTAINER="${MINIO_CONTAINER:-tskk-minio}"
MINIO_ALIAS="${MINIO_ALIAS:-local}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minio_admin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD required}"

BUCKETS=(
  "${MINIO_BUCKET_PHOTOS:-tskk-photos}"
  "${MINIO_BUCKET_CERTIFICATES:-tskk-certificates}"
  "${MINIO_BUCKET_VIDEOS:-tskk-videos}"
  "${MINIO_BUCKET_DOCUMENTS:-tskk-documents}"
)

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

log "Starting TSKK backup → ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}/postgres" "${TARGET_DIR}/minio"

# ── Postgres dump ───────────────────────────────────────────────────────────
log "Dumping Postgres database ${DB_NAME}"
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:?}" "${DB_CONTAINER}" \
  pg_dump --format=custom --no-owner --no-privileges --username="${DB_USER}" "${DB_NAME}" \
  > "${TARGET_DIR}/postgres/${DB_NAME}-${STAMP}.dump"
gzip -9 "${TARGET_DIR}/postgres/${DB_NAME}-${STAMP}.dump"
log "Postgres dump complete ($(du -h "${TARGET_DIR}/postgres/${DB_NAME}-${STAMP}.dump.gz" | cut -f1))"

# ── MinIO mirror ────────────────────────────────────────────────────────────
log "Configuring MinIO alias inside container"
docker exec "${MINIO_CONTAINER}" mc alias set "${MINIO_ALIAS}" http://localhost:9000 \
  "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null

for bucket in "${BUCKETS[@]}"; do
  log "Mirroring bucket ${bucket}"
  mkdir -p "${TARGET_DIR}/minio/${bucket}"
  docker exec "${MINIO_CONTAINER}" mc mirror --overwrite "${MINIO_ALIAS}/${bucket}" /tmp/backup > /dev/null || true
  docker cp "${MINIO_CONTAINER}:/tmp/backup/." "${TARGET_DIR}/minio/${bucket}/"
  docker exec "${MINIO_CONTAINER}" rm -rf /tmp/backup
done

# ── Compress the whole snapshot ─────────────────────────────────────────────
log "Compressing snapshot"
tar -C "${BACKUP_ROOT}" -czf "${BACKUP_ROOT}/tskk-${STAMP}.tar.gz" "${STAMP}"
rm -rf "${TARGET_DIR}"
log "Snapshot ready: ${BACKUP_ROOT}/tskk-${STAMP}.tar.gz ($(du -h "${BACKUP_ROOT}/tskk-${STAMP}.tar.gz" | cut -f1))"

# ── Retention ───────────────────────────────────────────────────────────────
log "Pruning backups older than ${RETENTION_DAYS} days"
find "${BACKUP_ROOT}" -maxdepth 1 -type f -name 'tskk-*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete

log "Backup finished successfully"
