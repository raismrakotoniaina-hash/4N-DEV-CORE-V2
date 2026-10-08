#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git nginx postgresql-client rsync openssh-client

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 is required. Install the supported Node.js 24 runtime before continuing."
  exit 1
fi

id 4ndev >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin 4ndev

mkdir -p /opt/4n-dev-core /etc/4n-dev-core /var/backups/4n-dev-core
chown -R 4ndev:4ndev /opt/4n-dev-core
chown root:4ndev /etc/4n-dev-core /var/backups/4n-dev-core
chmod 750 /etc/4n-dev-core
chmod 700 /var/backups/4n-dev-core

echo "Base VPS packages and service user are ready."
echo "Create /etc/4n-dev-core/core.env with NODE_ENV=production before deployment."
