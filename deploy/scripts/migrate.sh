#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
ENV_FILE="${ENV_FILE:-/etc/4n-dev-core/core.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Production environment file not found: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

cd "$APP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set."
  exit 1
fi

npm run db:migrate
