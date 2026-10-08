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

1. Run `deploy/scripts/install.sh` as root.
2. Create `/etc/4n-dev-core/core.env` with production values.
3. Run `deploy/scripts/deploy.sh`.
4. Install `deploy/systemd/4n-dev-core.service` into `/etc/systemd/system/`.
5. Install `deploy/systemd/4n-dev-core-backup.service` and `deploy/systemd/4n-dev-core-backup.timer`.
6. Install `deploy/nginx/4n-dev-core.conf` into `/etc/nginx/sites-available/`.
7. Enable the Nginx site.
8. Confirm the DNS A/AAAA record for the Core domain points to the VPS and that TCP ports 80 and 443 are reachable.
9. Run `deploy/scripts/setup-tls.sh <core-domain> <email>` as root. The script obtains the Let's Encrypt certificate through the HTTP-01 webroot challenge, installs the HTTPS Nginx configuration, reloads Nginx, and runs `certbot renew --dry-run`.
10. Verify `/health` through HTTPS.

PostgreSQL should remain private and must not be exposed directly to the public Internet.

The Node service runs as the dedicated `4ndev` system user, not root.


## HTTPS/TLS

The production TLS flow uses Nginx as the public HTTPS reverse proxy and Let's Encrypt certificates managed by Certbot.

The repository intentionally keeps the initial Nginx configuration HTTP-only so the ACME HTTP-01 challenge can complete before certificate files exist. The TLS configuration is stored separately in:

`deploy/nginx/4n-dev-core-tls.conf`

After the certificate is issued, `deploy/scripts/setup-tls.sh` activates the HTTPS configuration and redirects normal HTTP traffic to HTTPS.

Requirements before running the TLS setup:

- The Core DNS record must resolve to the VPS.
- TCP port 80 must be reachable from the Internet for HTTP-01 validation.
- TCP port 443 must be allowed for production HTTPS.
- Nginx must already be serving the Core HTTP site.
- The certificate email address must be valid and controlled by the operator.

Certbot's renewal configuration is managed by the installed Certbot package. Always verify renewal with:

`certbot renew --dry-run`

Do not manually copy or commit certificate/private-key files. They belong under `/etc/letsencrypt/` on the VPS.

Once HTTPS is active, production application URLs should use `https://`, including the Zopayo return URLs and webhook endpoint.

## PostgreSQL backup policy

The backup job runs daily through the systemd timer.

Local backups are stored in:

`/var/backups/4n-dev-core`

Default local retention is 7 days. It can be changed with:

`BACKUP_RETENTION_DAYS=<positive integer>`

Every backup is written to a temporary file first, checked with `gzip -t`, and only then renamed to its final backup filename.

### Off-site backup

For disaster recovery, configure an independent backup destination in the production environment:

`BACKUP_REMOTE_TARGET=<ssh-user>@<backup-host>`
`BACKUP_REMOTE_DIR=<remote-backup-directory>`

When `BACKUP_REMOTE_TARGET` is configured, the backup script requires `BACKUP_REMOTE_DIR` and uploads the verified archive using SSH/rsync.

Do not put an SSH private key, password, token, or other secret in this repository. Configure SSH credentials on the VPS using a dedicated backup identity with the minimum permissions required.

The off-site destination should be on infrastructure independent from the production VPS. A second directory on the same VPS is not considered disaster recovery.

### Restore policy

A restore must be treated as a destructive disaster-recovery operation.

Before restoring:

1. Verify the backup archive with `gzip -t`.
2. Verify the target PostgreSQL database and user.
3. For production, set `ALLOW_PRODUCTION_RESTORE=true`.
4. Confirm the exact database name.
5. Type `RESTORE-PRODUCTION` when prompted.
6. Restore with PostgreSQL error-stop enabled.

Never expose the restore script through an HTTP endpoint or application route.

## Backup verification

A successful backup job means:

- PostgreSQL dump completed.
- gzip archive integrity was verified.
- Local backup was written successfully.
- If off-site backup is configured, the rsync upload completed successfully.

A failed off-site upload causes the systemd backup job to fail. This prevents a false impression that disaster recovery is protected when only the local copy exists.

## Production database rules

- PostgreSQL must not listen publicly unless there is an explicit production architecture requiring it.
- Prefer a private/local PostgreSQL connection.
- Database credentials belong only in `/etc/4n-dev-core/core.env`.
- Run migrations through `npm run db:migrate`.
- Test restoration periodically on a non-production database.
- Keep at least one backup outside the production VPS before considering disaster recovery complete.
