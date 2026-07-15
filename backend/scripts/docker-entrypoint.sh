#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# TSKK backend — container entrypoint.
#
# Runs BEFORE the app process starts. Handles two things that would otherwise
# crash the Nest bootstrap on a fresh Postgres volume:
#
#   1. Applies the Prisma schema to the database (`prisma db push`).
#      We use `db push` — not `migrate deploy` — because the project is
#      still pre-launch and does not yet keep a migration history. `db push`
#      is idempotent, so running it on every container start is safe.
#      `--accept-data-loss` is passed so schema changes never require a
#      manual approval prompt in CI. Once we freeze the schema and start
#      shipping to production, switch this to `prisma migrate deploy` and
#      commit the generated migration SQL under prisma/migrations/.
#
#   2. Runs the seed script (`prisma db seed`). The seed uses `upsert` for
#      every record and is safe to run repeatedly, so we do it on every
#      startup. Failures here are logged but do not block the app (the
#      permission-catalogue table will simply be empty, which the app
#      tolerates — see PermissionsService).
#
# After both, we `exec "$@"` so the CMD (pnpm start:dev / node dist/main.js)
# becomes PID 1 and receives signals properly.
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "[entrypoint] applying Prisma schema to database (prisma db push)..."
if pnpm exec prisma db push --accept-data-loss --skip-generate; then
    echo "[entrypoint] schema applied successfully."
else
    echo "[entrypoint] prisma db push FAILED — aborting startup." >&2
    exit 1
fi

echo "[entrypoint] running database seed (idempotent)..."
if pnpm exec prisma db seed; then
    echo "[entrypoint] seed completed."
else
    echo "[entrypoint] seed reported an error — continuing anyway (app tolerates an empty catalogue)."
fi

echo "[entrypoint] handing off to CMD: $*"
exec "$@"
