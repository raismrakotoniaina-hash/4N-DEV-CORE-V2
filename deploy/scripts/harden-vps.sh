#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

apt-get update
apt-get install -y ufw fail2ban

if ! command -v ss >/dev/null 2>&1; then
  echo "ss is required to detect the active SSH listener safely."
  exit 1
fi

SSH_PORTS="$(ss -ltnpH 2>/dev/null | awk '/sshd/ {sub(/^.*:/, "", $4); print $4}' | sort -n | uniq)"

if [[ -z "$SSH_PORTS" ]] && command -v sshd >/dev/null 2>&1; then
  SSH_PORTS="$(sshd -T 2>/dev/null | awk '$1 == "port" {print $2}' | sort -n | uniq)"
fi

if [[ -z "$SSH_PORTS" ]]; then
  echo "Could not detect an active SSH port. Refusing to change the firewall."
  echo "This prevents accidental SSH lockout."
  exit 1
fi

ufw default deny incoming
ufw default allow outgoing

for port in $SSH_PORTS; do
  if [[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 )); then
    ufw allow "${port}/tcp"
  fi
done

ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

systemctl enable --now fail2ban

echo "VPS firewall and fail2ban are enabled."
echo "Allowed SSH TCP ports: $SSH_PORTS"
echo "Allowed public services: SSH, HTTP and HTTPS."
