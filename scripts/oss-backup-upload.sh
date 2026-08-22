#!/bin/sh
set -eu

: "${OSS_ACCESS_KEY_ID:?OSS_ACCESS_KEY_ID is required}"
: "${OSS_ACCESS_KEY_SECRET:?OSS_ACCESS_KEY_SECRET is required}"
: "${OSS_BUCKET:?OSS_BUCKET is required}"
: "${OSS_ENDPOINT:?OSS_ENDPOINT is required}"

OSSUTIL_BIN="${OSSUTIL_BIN:-/usr/local/bin/ossutil}"
BACKUP_DIR="${HBM_BACKUP_HOST_DIR:-/srv/healthy-body-manager/backups}"
OSS_PREFIX="${OSS_PREFIX:-healthy-body-manager}"
OSS_REGION="${OSS_REGION:-cn-beijing}"

if [ ! -x "$OSSUTIL_BIN" ]; then
  echo "ossutil is not installed at $OSSUTIL_BIN" >&2
  exit 1
fi

case "$OSS_BUCKET" in
  *[!a-z0-9-]*|'') echo "OSS_BUCKET contains invalid characters" >&2; exit 1 ;;
esac
case "$OSS_ENDPOINT" in
  *[!A-Za-z0-9.-]*|'') echo "OSS_ENDPOINT contains invalid characters" >&2; exit 1 ;;
esac
case "$OSS_PREFIX" in
  /*|*..*|'') echo "OSS_PREFIX must be a non-empty relative prefix" >&2; exit 1 ;;
esac

manifest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'healthy-body-*.sqlite.json' | LC_ALL=C sort | tail -n 1)"
if [ -z "$manifest" ]; then
  echo "No SQLite backup manifest found in $BACKUP_DIR" >&2
  exit 1
fi

database="${manifest%.json}"
if [ ! -f "$database" ]; then
  echo "Backup database is missing for $manifest" >&2
  exit 1
fi

umask 077
config_file="$(mktemp)"
verify_dir="$(mktemp -d)"
trap 'rm -f "$config_file"; rm -rf "$verify_dir"' EXIT HUP INT TERM

{
  printf '[default]\n'
  printf 'accessKeyID=%s\n' "$OSS_ACCESS_KEY_ID"
  printf 'accessKeySecret=%s\n' "$OSS_ACCESS_KEY_SECRET"
  printf 'region=%s\n' "$OSS_REGION"
} > "$config_file"

database_name="$(basename "$database")"
manifest_name="$(basename "$manifest")"
destination="oss://${OSS_BUCKET}/${OSS_PREFIX}"
endpoint="https://${OSS_ENDPOINT}"

"$OSSUTIL_BIN" cp "$database" "${destination}/${database_name}" --force --config-file "$config_file" --endpoint "$endpoint"
"$OSSUTIL_BIN" cp "$manifest" "${destination}/${manifest_name}" --force --config-file "$config_file" --endpoint "$endpoint"
"$OSSUTIL_BIN" cp "${destination}/${database_name}" "${verify_dir}/${database_name}" --force --config-file "$config_file" --endpoint "$endpoint"

local_sha="$(sha256sum "$database" | awk '{print $1}')"
remote_sha="$(sha256sum "${verify_dir}/${database_name}" | awk '{print $1}')"
if [ "$local_sha" != "$remote_sha" ]; then
  echo "OSS backup checksum mismatch for $database_name" >&2
  exit 1
fi

echo "OSS backup verified: ${destination}/${database_name}"
echo "SHA-256: $local_sha"
