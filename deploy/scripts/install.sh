#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl certbot git nginx postgresql-client rsync openssh-client

install_node_24() {
  echo "Installing Node.js 24..."
  curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup_24.x.sh
  bash /tmp/nodesource_setup_24.x.sh
  rm -f /tmp/nodesource_setup_24.x.sh
  apt-get install -y nodejs
}

if ! command -v node >/dev/null 2>&1; then
  install_node_24
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"

if [[ "$NODE_MAJOR" != "24" ]]; then
  install_node_24
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not installed with Node.js 24."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" != "24" ]]; then
  echo "Unsupported Node.js version: $(node -v). Node.js 24 is required."
  exit 1
fi

echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

id 4ndev >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin 4ndev

mkdir -p /opt/4n-dev-core /etc/4n-dev-core /var/backups/4n-dev-core /var/www/certbot
chown -R 4ndev:4ndev /opt/4n-dev-core
chown root:4ndev /etc/4n-dev-core /var/backups/4n-dev-core
chmod 750 /etc/4n-dev-core
chmod 700 /var/backups/4n-dev-core
chmod 755 /var/www/certbot

echo "Base VPS packages, Node.js 24, Certbot, webroot and service user are ready."
echo "Create /etc/4n-dev-core/core.env with NODE_ENV=production before continuing."
