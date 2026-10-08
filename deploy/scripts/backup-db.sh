#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/4n-dev-core}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set."
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required."
  exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "gzip is required."
  exit 1
fi

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$RETENTION_DAYS" -lt 1 ]]; then
  echo "BACKUP_RETENTION_DAYS must be a positive integer."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/4n-dev-core-$STAMP.sql.gz"
TMP_FILE="$FILE.tmp"

cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

pg_dump --format=plain --no-owner --no-privileges "$DATABASE_URL" | gzip > "$TMP_FILE"

gzip -t "$TMP_FILE"

mv "$TMP_FILE" "$FILE"
chmod 600 "$FILE"

find "$BACKUP_DIR" -type f -name '4n-dev-core-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created and verified: $FILE"
