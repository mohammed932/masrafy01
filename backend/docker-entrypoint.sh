#!/bin/sh
# Backend container entrypoint.
# Runs pending DB migrations (idempotent, prod-safe) before the app boots, then
# optionally seeds the bootstrap super_admin + questionnaire on first launch.
set -e

echo "[entrypoint] applying database migrations (prisma migrate deploy)"
npx prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] seeding (prisma db seed) — idempotent"
  npx prisma db seed
fi

echo "[entrypoint] starting: $*"
exec "$@"
