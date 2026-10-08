#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

DB_NAME="${DB_NAME:-4n_dev_core}"
DB_USER="${DB_USER:-4n_dev_core}"
ENV_FILE="${ENV_FILE:-/etc/4n-dev-core/core.env}"

if [[ ! "$DB_NAME" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "Invalid DB_NAME."
  exit 1
fi

if [[ ! "$DB_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "Invalid DB_USER."
  exit 1
fi

apt-get update
apt-get install -y postgresql postgresql-client openssl

systemctl enable --now postgresql

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required."
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is already configured. Refusing to replace it."
  echo "PostgreSQL service is installed and running."
  exit 0
fi

DB_PASSWORD="${DB_PASSWORD:-}"
if [[ -z "$DB_PASSWORD" ]]; then
  DB_PASSWORD="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)"
fi

if [[ -z "$DB_PASSWORD" ]]; then
  echo "Could not generate a database password."
  exit 1
fi

run_psql() {
  sudo -u postgres psql --set=ON_ERROR_STOP=1 "$@"
}

ROLE_EXISTS="$(run_psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'")"
if [[ "$ROLE_EXISTS" != "1" ]]; then
  run_psql -c "CREATE ROLE \"\$DB_USER\" LOGIN PASSWORD '$DB_PASSWORD';"
else
  run_psql -c "ALTER ROLE \"\$DB_USER\" WITH LOGIN PASSWORD '$DB_PASSWORD';"
fi

DB_EXISTS="$(run_psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")"
if [[ "$DB_EXISTS" != "1" ]]; then
  run_psql -c "CREATE DATABASE \"\$DB_NAME\" OWNER \"\$DB_USER\";"
else
  run_psql -c "ALTER DATABASE \"\$DB_NAME\" OWNER TO \"\$DB_USER\";"
fi

run_psql -c "REVOKE ALL ON DATABASE \"\$DB_NAME\" FROM PUBLIC;"
run_psql -c "GRANT CONNECT ON DATABASE \"\$DB_NAME\" TO \"\$DB_USER\";"

DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME"

mkdir -p /etc/4n-dev-core
if [[ -f "$ENV_FILE" ]]; then
  chmod 640 "$ENV_FILE"
  chown root:4ndev "$ENV_FILE"
  printf '\n# PostgreSQL configured by setup-postgres.sh\nDATABASE_URL=%s\n' "$DATABASE_URL" >> "$ENV_FILE"
else
  umask 027
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
DATABASE_URL=$DATABASE_URL
EOF
  chown root:4ndev "$ENV_FILE"
  chmod 640 "$ENV_FILE"
fi

echo "PostgreSQL production database is ready."
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "DATABASE_URL has been written to $ENV_FILE."
echo "The database password is not printed."
