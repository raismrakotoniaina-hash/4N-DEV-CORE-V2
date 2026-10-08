#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
REPO_URL="${REPO_URL:-https://github.com/raismrakotoniaina-hash/4N-DEV-CORE-V2.git}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-/etc/4n-dev-core/core.env}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Production environment file not found: $ENV_FILE"
  exit 1
fi

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Production environment file is not readable: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ "${NODE_ENV:-}" != "production" ]]; then
  echo "NODE_ENV=production is required for deployment."
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

if [[ ! -f package-lock.json ]]; then
  echo "package-lock.json is required for production deployment."
  exit 1
fi

npm ci --omit=dev
npm run db:migrate

chown -R 4ndev:4ndev "$APP_DIR"
systemctl daemon-reload
systemctl enable 4n-dev-core
systemctl restart 4n-dev-core

echo "4N DEV Core deployed."
