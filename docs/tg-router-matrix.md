# Telegram Router Matrix

## Event Sources

- `text`
- `callback`
- `pre_checkout`
- `successful_payment`
- `my_chat_member`
- `chat_member`

## Callback Commands

Observed in `WF1 — tg_update_router DEV.json`:

- `START_NEW`
- `START_FORCE_NEW`
- `START_CONTINUE`
- `GEN_FIRST`
- `GEN_NEXT`
- `GO_SEAL`
- `SEAL_PICK:<idx>`
- `PAY:<tariff>`
- `TZ:<timezone>`
- `DELIV_MANUAL`
- `DELIV_USERNAME`

## Text-State Handling

The router branches text events not only by event type, but also by session state.

### `awaiting = recipient_name`

Behavior:

- accept incoming text as recipient name
- update request recipient
- set `awaiting = none`
- keep `active_request_id`
- send "prepare document" message with `GEN_FIRST`

### `awaiting = email`

Behavior:

- validate email
- if invalid, send validation error
- if valid:
  - save `customer_email`
  - clear awaiting flag
  - keep `tariff_pending`
  - offer `PAY:<tariff_pending>`

### `awaiting = delivery_username`

Behavior:

- validate Telegram username
- if invalid, send validation error
- if valid:
  - persist delivery username
  - set `awaiting = none`
  - offer `PAY:199`

### `awaiting = tz`

Behavior:

- current n8n implementation expects timezone primarily from callback path `TZ:<timezone>`
- plain text timezone parsing is not the primary path

## Router Intent Targets

Recommended code-level target intents:

- `start_intro`
- `start_new`
- `start_force_new`
- `start_continue`
- `recipient_name_received`
- `generate_first`
- `generate_next`
- `go_seal`
- `seal_pick`
- `pay`
- `tz_set`
- `tz_change_requested`
- `delivery_manual`
- `delivery_username_requested`
- `delivery_username_received`
- `email_received`
- `ignore`

## Important Session Fields for Router

- `activeRequestId`
- `awaiting`
- `tariffPending`
- `currentVariantIdx`
- `lastVariantIdx`
- `recipientName`
- `lastInlineMessageId`
- `customerEmail`
- `initiatorTimezone`
- `tzReturnTo`

## Migration Note

This matrix is enough to implement the first code router layer even before repositories and downstream use cases are complete.
