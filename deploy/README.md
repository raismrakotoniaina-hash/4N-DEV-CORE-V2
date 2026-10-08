# 4N DEV Core V2 — VPS deployment

Production topology:

Internet → Nginx HTTPS → 127.0.0.1:10000 → 4N DEV Core → PostgreSQL

## Required

- Ubuntu/Debian VPS
- Node.js 24
- PostgreSQL
- Nginx
- DNS record pointing the Core domain to the VPS

## Production environment

Store production variables outside the repository at:

/etc/4n-dev-core/core.env

Protect the file:

chmod 600 /etc/4n-dev-core/core.env
chown root:4ndev /etc/4n-dev-core/core.env

Never commit production secrets.

## First deployment

1. Run deploy/scripts/install.sh as root.
2. Create /etc/4n-dev-core/core.env with production values.
3. Run deploy/scripts/deploy.sh.
4. Install deploy/systemd/4n-dev-core.service into /etc/systemd/system/.
5. Install deploy/nginx/4n-dev-core.conf into /etc/nginx/sites-available/.
6. Enable the Nginx site.
7. Configure HTTPS with a trusted ACME certificate.
8. Verify /health through HTTPS.

PostgreSQL should remain private and must not be exposed directly to the public Internet.

The Node service runs as the dedicated 4ndev system user, not root.
