#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: setup-tls.sh <domain> <email>"
  exit 1
fi

if [[ "$DOMAIN" == *"/"* || "$DOMAIN" == *" "* ]]; then
  echo "Invalid domain."
  exit 1
fi

if [[ ! -f "/etc/nginx/sites-available/4n-dev-core.conf" ]]; then
  echo "Nginx site not found: /etc/nginx/sites-available/4n-dev-core.conf"
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "Certbot is required. Install it before running this script."
  exit 1
fi

mkdir -p /var/www/certbot
chmod 755 /var/www/certbot

echo "Testing current HTTP Nginx configuration..."
nginx -t
systemctl reload nginx

echo "Requesting Let's Encrypt certificate for $DOMAIN..."
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --domain "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if [[ ! -f "$CERT_DIR/fullchain.pem" || ! -f "$CERT_DIR/privkey.pem" ]]; then
  echo "Certificate files were not created."
  exit 1
fi

TLS_TEMPLATE="/opt/4n-dev-core/deploy/nginx/4n-dev-core-tls.conf"
TLS_SITE="/etc/nginx/sites-available/4n-dev-core.conf"

if [[ ! -f "$TLS_TEMPLATE" ]]; then
  echo "TLS Nginx template not found: $TLS_TEMPLATE"
  exit 1
fi

sed "s/__CORE_DOMAIN__/$DOMAIN/g" "$TLS_TEMPLATE" > "$TLS_SITE"

echo "Testing HTTPS Nginx configuration..."
nginx -t

systemctl reload nginx

echo "Testing certificate renewal..."
certbot renew --dry-run

echo "HTTPS/TLS setup completed for $DOMAIN."
echo "Verify: https://$DOMAIN/health"
