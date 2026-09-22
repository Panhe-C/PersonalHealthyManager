#!/bin/sh
set -eu

node scripts/data-backup.mjs /backups
node scripts/data-backup-prune.mjs /backups
