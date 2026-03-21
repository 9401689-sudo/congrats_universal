# Campaign Authoring

This project is moving toward a reusable engine with plug-in campaigns.

## What A Campaign Owns

A campaign should describe product-specific behavior and assets, not infrastructure.

Each campaign owns:

- branding and document identity
- Telegram copy and button labels
- tariff rules and delivery policy
- variant presets and render defaults
- campaign-specific storage/schema prefixes when needed

The engine continues to own:

- Telegram webhook handling
- session/FSM orchestration
- payments, delivery worker, and persistence flow
- rendering pipeline execution
- shared adapters and repositories

## Campaign Vs Bot Runtime

These are now treated as different layers:

- `campaign`
  Describes the product itself: texts, branding, rules, render defaults, and content packs.
- `bot runtime`
  Describes how a campaign is published: Telegram token, YooKassa credentials, return URL, and runtime id.

This distinction matters because later we may want:

- several branded bots pointing at different campaigns
- several branded bots pointing at the same campaign
- one hub bot that routes users into campaign-specific bots

## Target Folder Shape

Each campaign should live in its own folder:

```text
src/campaigns/<campaign-id>/
  index.ts
  config.ts
  texts.ts
  rules.ts
  variants.ts
  renderer.ts
```

Right now `march8-razresheno` already follows this shape:

- [index.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/march8-razresheno/index.ts)
- [config.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/march8-razresheno/config.ts)
- [texts.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/march8-razresheno/texts.ts)
- [rules.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/march8-razresheno/rules.ts)
- [variants.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/march8-razresheno/variants.ts)
- [renderer.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/march8-razresheno/renderer.ts)

Legacy single-campaign source files still exist at the top level and are reused by that package during the transition. The next real campaign should be authored directly in the folder structure above instead of introducing new `current-*` files.

## What Each File Should Contain

- `config.ts`
  Campaign identity, branding, schema/storage namespaces, document metadata, bot username, QR URL, and helper builders like document number and Redis keys.
- `texts.ts`
  All Telegram copy and button labels.
- `rules.ts`
  Tariffs, timezone options, delivery-policy rules, and scheduling rules.
- `variants.ts`
  Backgrounds, template presets, and campaign-specific generation pools.
- `renderer.ts`
  Render payload builder and any campaign-specific renderer defaults.
- `index.ts`
  One exported `CampaignDefinition` assembled through `defineCampaign(...)`.

## Registration

To make a campaign available to the app:

1. Create `src/campaigns/<campaign-id>/...` with the six files above.
2. Export a `CampaignDefinition` from `src/campaigns/<campaign-id>/index.ts`
3. Register it in [campaign-registry.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/campaign-registry.ts)
4. Point a bot runtime at it via `campaignId`

## Runtime Wiring

Single-bot mode still works through:

- `CAMPAIGN_ID`
- `TELEGRAM_BOT_TOKEN`
- `YOOKASSA_*`

Multi-bot mode is prepared through:

- `DEFAULT_BOT_ID`
- `BOT_RUNTIMES_JSON`

Example:

```json
[
  {
    "id": "march8",
    "campaignId": "march8-razresheno",
    "telegramBotToken": "123:aaa"
  },
  {
    "id": "birthday",
    "campaignId": "birthday-classic",
    "telegramBotToken": "456:bbb"
  }
]
```

The runtime contract now lives in:

- [bot-runtime-definition.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/engine/runtime/bot-runtime-definition.ts)

## Before Creating The Next Campaign

The recommended sequence is:

1. Keep stabilizing the engine and runtime contracts.
2. Finish separating the current campaign into the folder structure above.
3. Decide which fields are truly campaign-specific versus bot-runtime-specific.
4. Only then create the second real campaign package.

This keeps the second campaign from becoming another one-off migration.

## Readiness Before The Next Campaign

Before we create the second campaign package, the codebase should already have:

- a stable `CampaignDefinition` contract that does not depend on `current-*` naming
- a real campaign package folder for `march8-razresheno`
- registry-based campaign lookup
- runtime config that can point a bot at a specific `campaignId`
- tests still passing after the packaging changes

That groundwork is the point where the next campaign becomes authoring work, not architecture work.
