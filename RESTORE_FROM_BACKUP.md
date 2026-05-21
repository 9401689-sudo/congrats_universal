# Restore From Backup

This document describes how to restore the project on a new VPS from the GitHub backup branch.

## 1. Clone The Repository

```bash
git clone git@github.com:9401689-sudo/congrats_universal.git
cd congrats_universal
```

## 2. Switch To The Backup Branch

```bash
git fetch origin
git switch server-backup-2026-05-21
```

## 3. Decrypt The Secrets

Encrypted files in the repository:

- `_server_secrets/congrats_universal__.env.gpg`
- `deploy/db/congrats_universal_2026-05-21.sql.gz.gpg`

Decrypt the environment file:

```bash
gpg --decrypt _server_secrets/congrats_universal__.env.gpg > .env
```

Decrypt the database dump:

```bash
gpg --decrypt deploy/db/congrats_universal_2026-05-21.sql.gz.gpg > deploy/db/congrats_universal_2026-05-21.sql.gz
gunzip -f deploy/db/congrats_universal_2026-05-21.sql.gz
```

Do not store the GPG passphrase in the repository.

## 4. Where To Put `.env`

The project expects:

- `.env` in the repository root

Confirmed by:

- `deploy/docker-compose.server.yml`
- `env_file: - ../.env`

After decryption, the final file should be:

- `./.env`

## 5. Restore Nginx / Systemd / Cron

Reference artifacts from the old server:

- `deploy/nginx/nginx_collected.conf`
- `deploy/nginx/apache_collected.conf`
- `deploy/systemd/systemd_units_collected.txt`
- `deploy/cron/cron_collected.txt`

### Nginx

This repository now includes project nginx templates:

- `deploy/nginx/congrats_universal.conf`
- `deploy/nginx/congrats_universal.ssl.example.conf`

The old server used nginx with a reverse proxy to:

- `127.0.0.1:3001`

Recommended starting point:

- use `deploy/nginx/congrats_universal.conf` for plain HTTP
- use `deploy/nginx/congrats_universal.ssl.example.conf` as the HTTPS template

Required edits:

- replace domain name
- replace SSL certificate paths
- confirm upstream app port

Typical workflow:

```bash
sudo cp deploy/nginx/congrats_universal.conf /etc/nginx/sites-available/congrats_universal
sudo ln -s /etc/nginx/sites-available/congrats_universal /etc/nginx/sites-enabled/congrats_universal
sudo nginx -t
sudo systemctl reload nginx
```

### Systemd

No dedicated project-specific systemd unit for the app was found on the old server.

Current conclusion:

- the app was run through Docker Compose, not its own systemd service

This repository now includes:

- `deploy/systemd/congrats_universal.compose.service.example`

Use it as a starting point if you want Docker Compose to auto-start on boot.

Typical workflow:

```bash
sudo cp deploy/systemd/congrats_universal.compose.service.example /etc/systemd/system/congrats_universal.service
sudo systemctl daemon-reload
sudo systemctl enable congrats_universal.service
sudo systemctl start congrats_universal.service
```

TODO:
- replace the project path inside the unit file
- verify the Docker Compose binary path on the new VPS

### Cron

No project-specific cron jobs were found on the old server.

TODO:
- if the new VPS needs scheduled tasks later, define them explicitly
- do not copy generic system cron files blindly

## 6. Restore Docker Volumes, If Needed

The self-contained compose now uses:

- named volume for render outputs:
  - `renders_data:/app/.local-renders`
- bind mount for template assets:
  - `../deploy/templates:/mnt/razresheno:ro`
- named volumes for infrastructure:
  - `postgres_data`
  - `redis_data`

Implications:

- Docker will create the named volumes automatically
- you must populate `deploy/templates` on disk before production use

Example:

```bash
mkdir -p deploy/templates
```

Then place the required renderer templates/assets under `deploy/templates`.

Keep:

- `PYTHON_RENDERER_TEMPLATES_DIR=/mnt/razresheno/templates`

unless you intentionally change the mount layout.

## 7. Restore The Database From The Encrypted Dump

Detected database type:

- PostgreSQL

Old runtime:

- app used `DATABASE_URL`
- old server DB container was `supabase-db`

If you restore into a Dockerized PostgreSQL container, the actual restore command depends on your new DB layout.

Minimal PostgreSQL example:

```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME -f deploy/db/congrats_universal_2026-05-21.sql
```

If the database lives inside a container:

```bash
docker exec -i YOUR_POSTGRES_CONTAINER psql -U YOUR_DB_USER -d YOUR_DB_NAME < deploy/db/congrats_universal_2026-05-21.sql
```

TODO:
- replace `YOUR_DB_HOST`, `YOUR_DB_USER`, `YOUR_DB_NAME`, and container name with the new VPS values
- verify that the target database exists before restore
- verify extensions/roles required by the dump if you are not restoring into a Supabase-compatible stack

## 8. Start The Project

Confirmed project command from the repository:

```bash
docker compose -f deploy/docker-compose.server.yml up -d --build
```

This is the closest known production-like startup path.

## 9. Verify Healthcheck

On the old server, the app listened on port `3001`.

Check local health:

```bash
curl http://127.0.0.1:3001/health
```

Check internal state:

```bash
curl http://127.0.0.1:3001/internal/state
```

If nginx is configured and the public hostname is already pointed correctly, also verify through the public endpoint:

```bash
curl https://YOUR_DOMAIN/health
```

## 10. Values To Replace On The New VPS

Before going live, review and replace at least the following:

- domain
  - old setup referenced `bot2.doorsvip.ru`
- IP
  - old nginx config referenced `109.196.165.84`
- filesystem paths
  - `/mnt/razresheno`
  - any renderer/template paths in `.env`
- SSL
  - certificates
  - certificate paths
  - TLS termination strategy
- reverse proxy
  - `server_name`
  - upstream target host/port
  - HTTP to HTTPS policy
- database credentials
  - `DATABASE_URL`
  - DB host/user/password/database
- Redis credentials
  - `REDIS_URL`
- bot/payment secrets
  - `TELEGRAM_BOT_TOKEN`
  - `YOOKASSA_SHOP_ID`
  - `YOOKASSA_SECRET_KEY`
  - values embedded inside `BOT_RUNTIMES_JSON`
- public webhook URLs
  - Telegram
  - YooKassa
  - MAX if still used

## Additional Notes

- The current server restore path no longer requires an external `supabase_default` network.
- The default restore path is a self-contained stack:
  - PostgreSQL
  - Redis
  - app
  - nginx

TODO:
- if you choose an external managed database instead of the bundled PostgreSQL container, update `DATABASE_URL`
- if you choose an external Redis instead of the bundled Redis container, update `REDIS_URL`
