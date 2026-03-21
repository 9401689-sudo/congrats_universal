# Congrats Code Migration

Local TypeScript backend that is replacing the current n8n workflow orchestration.

## Current Coverage

Already implemented in code:

- Telegram update normalization and routing
- session state
- request creation and recipient capture
- generation flow and variant snapshots
- seal pick and tariff selection
- timezone, delivery mode, email collection
- payment intent creation
- YooKassa webhook post-payment flow
- delivery worker scaffold

## Run Locally

1. Copy `.env.example` to `.env`
2. Fill the values you actually have
3. Install dependencies:

```bash
npm install
```

4. Start the server:

```bash
npm run dev
```

## Run In Docker

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

## Useful Endpoints

- `GET /health`
- `GET /internal/state`
- `POST /webhooks/telegram`
- `POST /webhooks/yookassa`
- `POST /internal/deliveries/run-once`

## Tests

```bash
npm test
```

## Notes

- If `DATABASE_URL` or `REDIS_URL` are missing, the app falls back to in-memory repositories for many flows.
- If YooKassa credentials are missing, payment creation uses a fake service and still lets you exercise the bot flow locally.
- If `TELEGRAM_BOT_TOKEN` is present, delivery worker can really send `sendDocument` to Telegram.
- Final rendering for local runs writes a JSON artifact to `RENDER_OUTPUT_DIR`, which is enough to exercise the delivery path without SSH rendering.
- If `PYTHON_RENDERER_BIN` and `PYTHON_RENDERER_SCRIPT_PATH` are set, the app uses the imported Python renderer from [render_doc.py](/C:/1_Work/Работа/Сайты/Боты/Congrats/renderer/legacy/render_doc.py).

## Quick Local Flow

1. Start the app with `npm run dev`
2. Check `GET /internal/state`
3. Send Telegram/YooKassa payloads to webhook endpoints
4. Run `POST /internal/deliveries/run-once`
5. Inspect files in `RENDER_OUTPUT_DIR`

## Git / Deploy

- Local git repository is initialized in this folder.
- Deployment artifacts live in [deploy/docker-compose.yml](/C:/1_Work/Работа/Сайты/Боты/Congrats/deploy/docker-compose.yml) and [deploy/deploy-checklist.md](/C:/1_Work/Работа/Сайты/Боты/Congrats/deploy/deploy-checklist.md).
