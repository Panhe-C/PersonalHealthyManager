#!/bin/sh
set -eu

case "${DATABASE_URL:-}" in
  file:/data/*) ;;
  *)
    echo "DATABASE_URL must point to the persistent /data volume." >&2
    exit 1
    ;;
esac

if [ -z "${HBM_OWNER_EMAIL:-}" ] || [ -z "${HBM_OWNER_PASSWORD:-}" ]; then
  echo "HBM_OWNER_EMAIL and HBM_OWNER_PASSWORD are required." >&2
  exit 1
fi

npx prisma migrate deploy
exec node --import tsx scripts/setup-owner.ts
