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
3. Set `CAMPAIGN_ID` to the campaign you want to run. Default: `march8-razresheno`
4. For future multi-bot runtime, you can keep using the single-bot env vars or provide `BOT_RUNTIMES_JSON`
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

For parallel server deploy on `bot2.doorsvip.ru`, use:

```bash
docker compose -f deploy/docker-compose.server.yml up -d --build
```

## Useful Endpoints

- `GET /health`
- `GET /internal/state`
- `POST /webhooks/telegram`
- `POST /webhooks/telegram/:botId`
- `POST /webhooks/max`
- `POST /webhooks/max/:botId`
- `POST /webhooks/yookassa`
- `POST /internal/deliveries/run-once`

## Tests

```bash
npm test
```

## Campaign Scaffold

```bash
npm run make:campaign -- birthday-classic
```

## MAX Webhook Setup

1. Add a MAX runtime to `BOT_RUNTIMES_JSON`, for example `max-main`
2. Choose a webhook URL such as `https://bot2.doorsvip.ru/webhooks/max/max-main`
3. Register it in MAX:

```bash
npm run max:subscribe -- --bot-id max-main --url https://bot2.doorsvip.ru/webhooks/max/max-main
```

If you set `webhookSecret` in the runtime, the server will require `X-Max-Bot-Api-Secret` on incoming MAX webhook calls.

## Notes

- If `DATABASE_URL` or `REDIS_URL` are missing, the app falls back to in-memory repositories for many flows.
- If YooKassa credentials are missing, payment creation uses a fake service and still lets you exercise the bot flow locally.
- `YOOKASSA_RETURN_URL` should point back to the bot entry URL, for example `https://t.me/<bot_username>`. If it is omitted, the service falls back to the active campaign Telegram URL.
- If `TELEGRAM_BOT_TOKEN` is present, delivery worker can really send `sendDocument` to Telegram.
- Final rendering for local runs writes a JSON artifact to `RENDER_OUTPUT_DIR`, which is enough to exercise the delivery path without SSH rendering.
- If `PYTHON_RENDERER_BIN` and `PYTHON_RENDERER_SCRIPT_PATH` are set, the app uses the imported Python renderer from [render_doc.py](/C:/1_Work/Работа/Сайты/Боты/Congrats/renderer/legacy/render_doc.py).
- For a safe parallel cutover, run this project on port `3001` and point `bot2.doorsvip.ru` to it first.
- The first multi-bot runtime layer is already present: one process can expose separate Telegram webhook paths per `botId`.
- The first multi-channel layer is also present: runtimes can now declare `channel: "telegram"` or `channel: "max"`.
- `campaign` and `bot runtime` are separate concepts now: campaign describes product/content, runtime describes token/keys/public entrypoint.
- Campaign authoring guidance lives in [campaign-authoring.md](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/docs/campaign-authoring.md).
- The current campaign already uses the package layout at [src/campaigns/march8-razresheno/index.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/march8-razresheno/index.ts), which is the template for future campaigns.

## Quick Local Flow

1. Start the app with `npm run dev`
2. Check `GET /internal/state`
3. Send Telegram/YooKassa payloads to webhook endpoints
4. Run `POST /internal/deliveries/run-once`
5. Inspect files in `RENDER_OUTPUT_DIR`

## Git / Deploy

- Local git repository is initialized in this folder.
- Deployment artifacts live in [deploy/docker-compose.yml](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/docker-compose.yml), [deploy/docker-compose.server.yml](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/docker-compose.server.yml) and [deploy/deploy-checklist.md](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/deploy-checklist.md).
