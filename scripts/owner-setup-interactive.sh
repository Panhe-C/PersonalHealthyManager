#!/usr/bin/env bash
set -euo pipefail

app_dir="${HBM_APP_DIR:-/srv/healthy-body-manager/app}"
env_file="$app_dir/.env"
compose_file="$app_dir/compose.production.yml"

if [[ ! -t 0 ]]; then
  echo "Run this command from an interactive terminal." >&2
  exit 1
fi
if [[ ! -r "$env_file" ]]; then
  echo "Cannot read $env_file" >&2
  exit 1
fi

owner_email="$(sed -n 's/^HBM_OWNER_EMAIL=//p' "$env_file" | tail -n 1)"
if [[ -z "$owner_email" ]]; then
  echo "HBM_OWNER_EMAIL is missing from $env_file" >&2
  exit 1
fi

password=""
confirmation=""
trap 'unset password confirmation HBM_OWNER_EMAIL HBM_OWNER_PASSWORD' EXIT

read -r -s -p "请输入 HBM 密码（12-128 位）: " password
printf '\n'
read -r -s -p "请再次输入密码: " confirmation
printf '\n'

if [[ "$password" != "$confirmation" ]]; then
  echo "两次密码不一致" >&2
  exit 1
fi
if (( ${#password} < 12 || ${#password} > 128 )); then
  echo "密码长度必须为 12-128 位" >&2
  exit 1
fi

export HBM_OWNER_EMAIL="$owner_email"
export HBM_OWNER_PASSWORD="$password"

cd "$app_dir"
docker compose --env-file "$env_file" -f "$compose_file" \
  --profile tools run --rm \
  -e HBM_OWNER_EMAIL \
  -e HBM_OWNER_PASSWORD \
  owner-setup
