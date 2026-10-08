#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/4n-dev-core}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/4n-dev-core-$STAMP.sql.gz"

pg_dump --format=plain --no-owner --no-privileges "$DATABASE_URL" | gzip > "$FILE"
chmod 600 "$FILE"

find "$BACKUP_DIR" -type f -name '4n-dev-core-*.sql.gz' -mtime +7 -delete

echo "Backup created: $FILE"
