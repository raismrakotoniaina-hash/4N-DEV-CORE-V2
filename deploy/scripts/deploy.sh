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

CORE_DOMAIN="${CORE_DOMAIN:-}"
if [[ -z "$CORE_DOMAIN" ]]; then
  echo "CORE_DOMAIN is required in $ENV_FILE."
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

install -m 0644 deploy/systemd/4n-dev-core.service /etc/systemd/system/4n-dev-core.service
install -m 0644 deploy/systemd/4n-dev-core-backup.service /etc/systemd/system/4n-dev-core-backup.service
install -m 0644 deploy/systemd/4n-dev-core-backup.timer /etc/systemd/system/4n-dev-core-backup.timer

mkdir -p /var/www/certbot /etc/nginx/sites-available /etc/nginx/sites-enabled
chmod 755 /var/www/certbot

if [[ -f "/etc/letsencrypt/live/$CORE_DOMAIN/fullchain.pem" && -f "/etc/letsencrypt/live/$CORE_DOMAIN/privkey.pem" ]]; then
  sed "s/__CORE_DOMAIN__/$CORE_DOMAIN/g" deploy/nginx/4n-dev-core-tls.conf > /etc/nginx/sites-available/4n-dev-core.conf
  echo "Existing TLS certificate detected; keeping HTTPS Nginx configuration."
else
  sed "s/core\.4ndev\.com/$CORE_DOMAIN/g" deploy/nginx/4n-dev-core.conf > /etc/nginx/sites-available/4n-dev-core.conf
  echo "No TLS certificate detected; installing HTTP/ACME Nginx configuration."
fi

ln -sfn /etc/nginx/sites-available/4n-dev-core.conf /etc/nginx/sites-enabled/4n-dev-core.conf
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

npm run db:migrate

chown -R 4ndev:4ndev "$APP_DIR"
systemctl daemon-reload
systemctl enable 4n-dev-core
systemctl enable 4n-dev-core-backup.timer
systemctl restart 4n-dev-core
systemctl restart 4n-dev-core-backup.timer

echo "4N DEV Core deployed."
