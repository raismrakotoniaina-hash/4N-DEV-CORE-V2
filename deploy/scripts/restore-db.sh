#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
DATABASE_URL="${DATABASE_URL:-}"
ALLOW_PRODUCTION="${ALLOW_PRODUCTION_RESTORE:-false}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: restore-db.sh /path/to/backup.sql.gz"
  echo
  echo "Production restore additionally requires:"
  echo "  ALLOW_PRODUCTION_RESTORE=true"
  echo "  and an interactive production confirmation."
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

if ! command -v gzip >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  echo "gzip and psql are required."
  exit 1
fi

echo "Verifying backup archive..."
gzip -t "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "Backup file is empty."
  exit 1
fi

echo "Verifying PostgreSQL connection..."
DB_NAME="$(psql "$DATABASE_URL" -Atqc 'SELECT current_database();')"
DB_USER="$(psql "$DATABASE_URL" -Atqc 'SELECT current_user;')"

if [[ -z "$DB_NAME" || -z "$DB_USER" ]]; then
  echo "Could not verify the target PostgreSQL database."
  exit 1
fi

echo
echo "Restore target:"
echo "  Database: $DB_NAME"
echo "  User:     $DB_USER"
echo "  Backup:   $BACKUP_FILE"
echo

if [[ "${NODE_ENV:-development}" == "production" ]]; then
  if [[ "$ALLOW_PRODUCTION" != "true" ]]; then
    echo "Refusing production restore."
    echo "Set ALLOW_PRODUCTION_RESTORE=true only after confirming this is an intentional disaster-recovery operation."
    exit 1
  fi

  echo "!!! PRODUCTION DATABASE RESTORE !!!"
  echo "This operation can overwrite or conflict with existing production data."
  read -r -p "Type the exact database name ($DB_NAME) to continue: " CONFIRM_DB

  if [[ "$CONFIRM_DB" != "$DB_NAME" ]]; then
    echo "Production database name confirmation failed. Restore cancelled."
    exit 1
  fi

  read -r -p "Type RESTORE-PRODUCTION to continue: " CONFIRM_PRODUCTION

  if [[ "$CONFIRM_PRODUCTION" != "RESTORE-PRODUCTION" ]]; then
    echo "Production restore cancelled."
    exit 1
  fi
else
  read -r -p "Type RESTORE to continue: " CONFIRM

  if [[ "$CONFIRM" != "RESTORE" ]]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

echo "Restoring with ON_ERROR_STOP=1..."
gzip -dc "$BACKUP_FILE" | psql "$DATABASE_URL" --set ON_ERROR_STOP=1

echo "Database restore completed successfully."
