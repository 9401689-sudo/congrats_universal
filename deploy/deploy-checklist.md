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

## First Start

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

## Smoke Checks

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/internal/state
```

## Manual Worker Run

```bash
curl -X POST http://127.0.0.1:3000/internal/deliveries/run-once
```

## Roll Forward

```bash
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```
