#!/bin/sh
set -eu

case "${DATABASE_URL:-}" in
  file:/data/*) ;;
  *)
    echo "DATABASE_URL must point to the persistent /data volume (for example file:/data/healthy-body.sqlite)." >&2
    exit 1
    ;;
esac

if [ -z "${SETTINGS_ENCRYPTION_KEY:-}" ]; then
  echo "SETTINGS_ENCRYPTION_KEY is required in production." >&2
  exit 1
fi

node /app/node_modules/prisma/build/index.js migrate deploy
exec node /app/server.js
