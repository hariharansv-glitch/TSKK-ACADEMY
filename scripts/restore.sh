#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TSKK Academy Platform — Restore script.
# Usage: ./restore.sh /var/backups/tskk/tskk-<STAMP>.tar.gz
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-archive.tar.gz>" >&2
  exit 1
fi

ARCHIVE="$1"
[[ -f "${ARCHIVE}" ]] || { echo "Archive not found: ${ARCHIVE}" >&2; exit 1; }

WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

DB_CONTAINER="${DB_CONTAINER:-tskk-postgres}"
DB_USER="${POSTGRES_USER:-tskk_admin}"
DB_NAME="${POSTGRES_DB:-tskk_academy}"

MINIO_CONTAINER="${MINIO_CONTAINER:-tskk-minio}"
MINIO_ALIAS="${MINIO_ALIAS:-local}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minio_admin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD required}"

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

log "Extracting ${ARCHIVE}"
tar -xzf "${ARCHIVE}" -C "${WORKDIR}"

SNAPSHOT_DIR="$(find "${WORKDIR}" -mindepth 1 -maxdepth 1 -type d | head -n1)"
[[ -n "${SNAPSHOT_DIR}" ]] || { echo "Snapshot dir missing" >&2; exit 1; }

log "Restoring Postgres database ${DB_NAME}"
DUMP_FILE="$(find "${SNAPSHOT_DIR}/postgres" -name '*.dump.gz' | head -n1)"
[[ -n "${DUMP_FILE}" ]] || { echo "Postgres dump missing" >&2; exit 1; }

gunzip -c "${DUMP_FILE}" | docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD:?}" "${DB_CONTAINER}" \
  pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${DB_NAME}" --username="${DB_USER}"

log "Configuring MinIO alias"
docker exec "${MINIO_CONTAINER}" mc alias set "${MINIO_ALIAS}" http://localhost:9000 \
  "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null

for bucket_dir in "${SNAPSHOT_DIR}/minio/"*/; do
  bucket="$(basename "${bucket_dir}")"
  log "Restoring bucket ${bucket}"
  docker exec "${MINIO_CONTAINER}" mc mb --ignore-existing "${MINIO_ALIAS}/${bucket}" > /dev/null
  docker cp "${bucket_dir}" "${MINIO_CONTAINER}:/tmp/restore-${bucket}"
  docker exec "${MINIO_CONTAINER}" mc mirror --overwrite "/tmp/restore-${bucket}" "${MINIO_ALIAS}/${bucket}" > /dev/null
  docker exec "${MINIO_CONTAINER}" rm -rf "/tmp/restore-${bucket}"
done

log "Restore complete"
