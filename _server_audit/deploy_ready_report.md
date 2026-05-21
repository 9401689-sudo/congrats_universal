# Deploy Ready Report

Date: 2026-05-21

## SSH

- Working access confirmed with `ssh bot2.doorsvip.ru`
- Effective target:
  - host: `109.196.165.84`
  - user: `root`
  - key: `~/.ssh/id_ed25519`
- Local SSH config updated to include:
  - `Host bot2.doorsvip.ru`
  - `Host congrats-bot2`

## Server Project State

- Project path on current VPS: `/root/congrats_universal`
- Running container: `congrats-universal-app`
- Health endpoint responds on `https://bot2.doorsvip.ru/health`
- Git commit on server: `f9c8f79630fcaf7a7abff12f94bfee26b7ea6bf3`
- Server working tree difference observed:
  - `update.sh` executable bit is set on server

## Local vs Server Copy

- A full server copy was downloaded to `_server_audit/server-copy`
- Brief diff result shows the running server is **not** identical to the current local working tree
- Key differences:
  - server copy contains `.env`, local root does not
  - local `.gitignore` differs from server copy
  - local `package.json` differs from server copy
  - local `package-lock.json` differs from server copy
  - local `renderer/legacy/render_doc.py` differs from server copy
  - local `renderer/legacy/render_doc.test-input.json` differs from server copy
  - local-only directories exist: `src/adapters/app`, `src/adapters/bot`, `src/adapters/rendering`, `src/campaigns/sample-campaign`, `tools`
  - local-only file exists: `congrats_universal.code-workspace`
- For a new VPS migration, the safest source of truth is the captured server snapshot in `_server_audit/server-copy` or the cleaned bundle derived from it

## Runtime Layout

- Deploy compose file: [deploy/docker-compose.server.yml](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/docker-compose.server.yml)
- Update script: [update.sh](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/update.sh)
- Container port mapping:
  - `3001:3001`
- Bind mounts:
  - `/root/congrats_universal/.local-renders -> /app/.local-renders`
  - `/mnt/razresheno -> /mnt/razresheno:ro`
- External Docker network required:
  - `supabase_default`

## Required Environment Variables

- `NODE_ENV`
- `HOST`
- `PORT`
- `CAMPAIGN_ID`
- `DEFAULT_BOT_ID`
- `BOT_RUNTIMES_JSON`
- `DATABASE_URL`
- `REDIS_URL`
- `RENDER_OUTPUT_DIR`
- `PYTHON_RENDERER_BIN`
- `PYTHON_RENDERER_SCRIPT_PATH`
- `PYTHON_RENDERER_TEMPLATES_DIR`
- `TELEGRAM_BOT_TOKEN`
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `YOOKASSA_RETURN_URL`

## New VPS Checklist

1. Install Docker and Docker Compose.
2. Copy this project to the new VPS, keeping:
   - project files
   - `.env`
   - `.local-renders` if you want historical preview artifacts
3. Recreate or intentionally replace the external dependencies:
   - Postgres reachable from `DATABASE_URL`
   - Redis reachable from `REDIS_URL`
   - Docker network `supabase_default` or adjust compose to use a different network strategy
4. Decide what to do with `/mnt/razresheno`:
   - mount the same source on the new VPS, or
   - remove/replace this bind mount if the renderer no longer depends on it
5. Ensure Python renderer paths in `.env` are valid on the new VPS.
6. Start the app:
   - `docker compose -f deploy/docker-compose.server.yml up -d --build`
7. Verify locally on the VPS:
   - `curl http://127.0.0.1:3001/health`
   - `curl http://127.0.0.1:3001/internal/state`
8. Recreate reverse proxy routing for:
   - `/health`
   - `/webhooks/telegram`
   - `/webhooks/yookassa`
   - `/webhooks/max/*` if MAX remains in use
9. Repoint external webhooks only after health and internal state checks pass.

## Risks To Resolve Before Final Cutover

- Local machine does not have the real `.env`, only `.env.example`
- Current deploy assumes an existing `supabase_default` Docker network
- Current deploy assumes `/mnt/razresheno` exists on the host
- Reverse proxy config is not stored in this repository
