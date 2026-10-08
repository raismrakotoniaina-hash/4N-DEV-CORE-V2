#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
cd "$APP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set."
  exit 1
fi

npm run db:migrate
