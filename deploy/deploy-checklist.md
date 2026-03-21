# Deploy Checklist

## Before First Deploy

1. Prepare server with:
   - Docker
   - Docker Compose
   - outbound access to Telegram and YooKassa
2. Put project on server.
3. Fill `.env` with real values.
4. Ensure Postgres schema already exists.
5. Ensure Redis is reachable.
6. Prepare reverse proxy for `bot2.doorsvip.ru`.

## Recommended Parallel Setup

- Current production-like bot stays on the old project and keeps its webhook.
- `congrats_universal` runs separately on port `3001`.
- Reverse proxy should route:
  - `https://bot2.doorsvip.ru/webhooks/telegram` -> `http://127.0.0.1:3001/webhooks/telegram`
  - `https://bot2.doorsvip.ru/webhooks/yookassa` -> `http://127.0.0.1:3001/webhooks/yookassa`
  - `https://bot2.doorsvip.ru/health` -> `http://127.0.0.1:3001/health`

## First Start

```bash
docker compose -f deploy/docker-compose.server.yml up -d --build
```

## Smoke Checks

```bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/internal/state
```

## Manual Worker Run

```bash
curl -X POST http://127.0.0.1:3001/internal/deliveries/run-once
```

## Telegram Cutover

After `bot2.doorsvip.ru` is alive and smoke checks pass:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://bot2.doorsvip.ru/webhooks/telegram\"}"
```

Verify:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

## Roll Forward

```bash
git pull
docker compose -f deploy/docker-compose.server.yml up -d --build
```
