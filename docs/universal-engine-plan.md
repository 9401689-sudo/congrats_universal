# Universal Engine Plan

## Goal

Turn the current single-campaign bot into:

- reusable engine code
- one or more campaign packages
- optional legacy-compatible adapters for the current March 8 flow

## Already Extracted

The first extraction pass is now concentrated in [src/campaigns/current-campaign.ts](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/src/campaigns/current-campaign.ts):

- Redis namespace
- Postgres schema name
- document number prefix
- bot username / QR URL
- payment item description
- default preview content pool
- renderer templates directory

This is intentionally a low-risk pass: it keeps runtime behavior the same while removing the most dangerous hardcoded campaign constants from scattered modules.

## Next Extractions

1. Telegram copy and button labels
2. tariff definitions and delivery policy
3. render defaults inside Python renderer
4. campaign-specific schedule rules
5. campaign-specific variant generation content
6. DB bootstrap naming and storage adapters

## Target Structure

```text
src/
  engine/
    bot/
    payments/
    rendering/
    scheduling/
    state/
  campaigns/
    march8-razresheno/
      config.ts
      texts.ts
      variants.ts
      renderer.ts
```

## Migration Strategy

1. Keep current runtime behavior passing tests.
2. Extract config before extracting behavior.
3. Replace hardcoded strings with campaign selectors.
4. Only then split folders into `engine/` and `campaigns/`.

## Constraint

The current `congrats` repository remains a standalone deployable service.
This repository is the place where we can generalize and simplify without risking that running bot.
