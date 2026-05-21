# Server Inventory

Date: 2026-05-21

## Project Path

- Server project path: `/root/congrats_universal`

## Git State

- `git remote -v`
  - `origin https://github.com/9401689-sudo/congrats_universal.git (fetch)`
  - `origin https://github.com/9401689-sudo/congrats_universal.git (push)`
- Current branch:
  - `main`
- Last commit:
  - `f9c8f79 Keep a sticky MAX welcome entrypoint`
- `git status` summary:
  - branch is `main...origin/main`
  - tracked local modification exists: `update.sh`
  - untracked files: none

## Env Files

- Found on server:
  - `/root/congrats_universal/.env`
  - `/root/congrats_universal/.env.example`
- In git:
  - `.env.example`
- Not in git:
  - `.env`
- Ignore status:
  - `.env` is ignored by `.gitignore`

## Docker / Nginx / Apache / Systemd / Deploy Files

- Docker files found:
  - `/root/congrats_universal/Dockerfile`
  - `/root/congrats_universal/deploy/docker-compose.yml`
  - `/root/congrats_universal/deploy/docker-compose.server.yml`
- Deploy files found:
  - `/root/congrats_universal/deploy/bootstrap.sql`
  - `/root/congrats_universal/deploy/deploy-checklist.md`
  - `/root/congrats_universal/update.sh`
- Proxy-related files found near project:
  - `/root/congrats_universal/deploy/CADDYFILE.example`
- README files found:
  - `/root/congrats_universal/README.md`
  - `/root/congrats_universal/src/infra/README.md`
- Scripts found:
  - `/root/congrats_universal/scripts/benchmark_renderer.py`
  - `/root/congrats_universal/scripts/make-campaign.ts`
  - `/root/congrats_universal/scripts/register-max-commands.ts`
  - `/root/congrats_universal/scripts/register-max-webhook.ts`
- Migrations directory:
  - no `migrations` directory found under the project root
- Nginx files рядом с проектом:
  - none found in the project tree
- Apache files рядом с проектом:
  - none found in the project tree
- Systemd files рядом с проектом:
  - none found in the project tree

## Runtime Directories

- Requested runtime directory names found under the project root:
  - none
- Match that appears only because of git internals:
  - `/root/congrats_universal/.git/logs`
- Additional runtime-like directories worth noting for migration:
  - `/root/congrats_universal/.local-renders`
  - `/root/congrats_universal/.local-renders/previews`

## Tracked vs Not Tracked

- In git:
  - `Dockerfile`
  - `README.md`
  - `deploy/CADDYFILE.example`
  - `deploy/bootstrap.sql`
  - `deploy/deploy-checklist.md`
  - `deploy/docker-compose.yml`
  - `deploy/docker-compose.server.yml`
  - `scripts/benchmark_renderer.py`
  - `scripts/make-campaign.ts`
  - `scripts/register-max-commands.ts`
  - `scripts/register-max-webhook.ts`
  - `.env.example`
- Tracked but locally modified on server:
  - `update.sh`
- Not tracked in git:
  - `.env`
- Ignored by git:
  - `.env`
  - `.local-renders/`
- Untracked non-ignored files:
  - none

## Notes

- The formal inventory task is now complete.
- SSH access is already working and was used for this inventory.
