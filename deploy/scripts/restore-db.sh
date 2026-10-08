#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
DATABASE_URL="${DATABASE_URL:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: restore-db.sh /path/to/backup.sql.gz"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL is not set."
  exit 1
fi

echo "WARNING: this restores the selected PostgreSQL backup into DATABASE_URL."
read -r -p "Type RESTORE to continue: " CONFIRM

if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 1
fi

gzip -dc "$BACKUP_FILE" | psql "$DATABASE_URL"

echo "Database restore completed."
