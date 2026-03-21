# Congrats: n8n Architecture Audit

## Scope

This audit is based on the exported workflows in the current workspace:

- `1_TG_Webhook.json`
- `WF1 — tg_update_router DEV.json`
- `2_START_INTRO.json`
- `2_START.json`
- `2_GEN.json`
- `2_GO_SEAL.json`
- `2_SEAL_PICK.json`
- `2_PAY.json`
- `2_BUILD_PAYMENT.json`
- `2_TZ.json`
- `2_TZ_CHANGE.json`
- `2_DELIV_USERNAME.json`
- `2_DELIV_MANUAL.json`
- `2_save_session_final.json`
- `3_YOOKASSA_WEBHOOK.json`
- `4_deliveries_scheduler.json`
- `4_delivery_worker.json`

## Executive Summary

The current project is already a backend application implemented in n8n. It is not a linear automation chain. It is a stateful Telegram bot system with:

- webhook ingress
- finite-state conversation flow
- Redis-backed session state
- Postgres-backed domain records
- payment lifecycle via YooKassa
- async generation and delivery
- scheduled delivery jobs
- external rendering over SSH

The migration target should therefore be a code application with explicit domain modules and queues, not a one-to-one rewrite of each workflow into separate services.

## Current Runtime Topology

### Entry Points

- Telegram webhook:
  - `1_TG_Webhook.json`
  - receives Telegram updates and dispatches into the main router workflow
- YooKassa webhook:
  - `3_YOOKASSA_WEBHOOK.json`
  - receives payment lifecycle callbacks
- Scheduled delivery trigger:
  - `4_deliveries_scheduler.json`
  - polls due deliveries and invokes worker logic

### Main Application Flow

- `WF1 — tg_update_router DEV.json` is the central orchestrator.
- It normalizes Telegram updates, deduplicates them, restores Redis session, resolves FSM state, and delegates to subworkflows.
- The main callback commands observed in the router are:
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

## Domain Model Observed in Workflows

### Session in Redis

Redis session key pattern:

- `razresheno:sess:<tg_user_id>`

Variant cache key pattern:

- `razresheno:req:<request_id>:v:<idx>`

Session fields repeatedly used across workflows:

- `tg_user_id`
- `chat_id`
- `chat_type`
- `tg_username`
- `tg_first_name`
- `tg_last_name`
- `last_inline_message_id`
- `active_request_id`
- `awaiting`
- `tariff_pending`
- `current_variant_idx`
- `last_variant_idx`
- `recipient_name`
- `initiator_timezone`
- `tz_return_to`
- `customer_email`
- `last_update_id`
- `last_event_type`
- `last_callback_data`

Important conclusion:

- the current bot is already modeled as a finite-state machine, but state transitions are implicit and scattered across many `Code` nodes

### Postgres Entities

Observed tables:

- `razreshenobot.users`
- `razreshenobot.requests`
- `razreshenobot.payments`
- `razreshenobot.documents`
- `razreshenobot.deliveries`
- `razreshenobot.update_dedup`

Observed enum-like domain concepts:

- request status: `open`, `closed`, `cancelled`
- payment status: `paid`
- delivery method: `manual`, `username`
- delivery status: `scheduled`
- document tariff: `149`, `199`

### Business Aggregates

A practical code-first aggregate split would be:

- `User`
- `Request`
- `Session`
- `VariantPreview`
- `Payment`
- `Document`
- `Delivery`

## Workflow Responsibilities

### Telegram Flow

- `2_START_INTRO`
  - shows intro menu
  - cleans previous inline keyboard state
- `2_START`
  - creates a new request
  - resets or replaces active session request
  - prompts for recipient name
- `2_GEN`
  - builds the next preview variant
  - persists variant snapshot in Redis
  - sends preview to Telegram
- `2_GO_SEAL`
  - checks whether generation is ready
  - asks the user to pick one of the generated variants
- `2_SEAL_PICK`
  - validates selected variant
  - persists selected variant into request
  - branches to tariff selection
- `2_PAY`
  - validates request state
  - chooses delivery branch
  - chooses timezone branch for tariff `199`
  - may request email before payment
- `2_BUILD_PAYMENT`
  - builds YooKassa request
  - stores pending payment record
  - sends payment confirmation URL
- `2_TZ`
  - stores timezone to request and/or user profile
  - can route back to tariffs or continue payment
- `2_TZ_CHANGE`
  - starts manual timezone change flow
- `2_DELIV_USERNAME`
  - switches bot into `delivery_username` waiting mode
- `2_DELIV_MANUAL`
  - stores manual delivery choice
- `2_save_session_final`
  - normalizes and persists final session snapshot

### Payment and Fulfillment

- `3_YOOKASSA_WEBHOOK`
  - validates YooKassa event
  - updates payment record
  - creates or updates document record
  - for tariff `149`: immediately finalizes and sends document
  - for tariff `199`: schedules delivery and closes request

### Delivery

- `4_deliveries_scheduler`
  - selects due deliveries
  - takes DB lock
  - invokes worker
- `4_delivery_worker`
  - loads pending deliveries
  - prepares final rendering context
  - sends or uploads final file
  - marks delivery as sent
  - optionally closes request

## Integration Map

### Telegram

Observed usage:

- direct Bot API HTTP calls
- Telegram node usage
- message sending
- reply markup clearing
- file sending

Migration note:

- use one adapter layer only in code
- do not mix raw HTTP and library-specific calls

### YooKassa

Observed usage:

- payment creation through `https://api.yookassa.ru/v3/payments`
- webhook processing
- provider payment id stored in Postgres
- idempotence key generated in workflow code

### Redis

Observed usage:

- session persistence
- variant snapshot storage
- pending payment continuation state

### Postgres

Observed usage:

- raw SQL queries across all business flows
- deduplication by `update_id`
- request lifecycle management
- payment lifecycle management
- delivery scheduling and locking

Migration note:

- keep SQL-first repositories in the first migration stage
- do not introduce a heavy ORM abstraction before parity is reached

### SSH Rendering

Observed usage:

- preview generation and file sending in `2_GEN`
- final file generation and sending in `3_YOOKASSA_WEBHOOK`
- delivery worker uses similar rendering/final-send logic

Migration note:

- keep this as an infrastructure adapter in phase 1
- replace later only after parity is stable

## Risks in Current State

### 1. Business logic is fragmented

Many critical transitions are embedded in `Code` nodes. The same session normalization logic appears in multiple workflows.

Impact:

- hard to test
- hard to reason about parity
- easy to introduce drift between branches

### 2. State machine is implicit

The FSM exists, but it is encoded indirectly through `awaiting`, callback strings, and subworkflow branching.

Impact:

- behavior is harder to audit
- transitions are not centrally validated

### 3. Duplicate helper logic

Session parsing, inline message cleanup, and request/session patching are repeated across workflows.

Impact:

- migration without consolidation will copy technical debt into code

### 4. Sensitive data exposure

Telegram Bot API token appears directly in exported workflow JSON.

Impact:

- token should be treated as compromised
- secrets management must be part of migration day zero

### 5. Async flow spans multiple transports

Telegram webhook, YooKassa webhook, SSH jobs, scheduled delivery, and Redis session state all interact in one business transaction chain.

Impact:

- migration must be incremental and parity-driven
- a big-bang rewrite would be unnecessarily risky

## Recommended Target Architecture

Recommended first target:

- TypeScript
- Node.js 22
- Fastify for HTTP/webhooks
- grammY or a thin Telegram adapter for bot interaction
- Postgres with SQL-first repositories
- Redis for session storage
- BullMQ for generation and delivery jobs
- modular monolith architecture

Why this matches the current system:

- current business logic is already in JavaScript
- current boundaries map well to code modules
- async and scheduled flows naturally fit job queues
- modular monolith keeps migration simpler than microservices

## Proposed Code Modules

- `modules/telegram`
  - update normalization
  - callback parsing
  - outbound message adapter
- `modules/session`
  - `BotSession` schema
  - Redis repository
  - session patch helpers
- `modules/fsm`
  - event routing
  - explicit state transitions
- `modules/requests`
  - request lifecycle use cases
- `modules/variants`
  - preview generation metadata
  - selected variant logic
- `modules/payments`
  - payment creation
  - webhook handling
  - continuation after payment
- `modules/documents`
  - document creation/finalization
- `modules/delivery`
  - schedule due deliveries
  - send delivery
- `modules/rendering`
  - preview rendering adapter
  - final rendering adapter
- `infra`
  - Postgres
  - Redis
  - queues
  - SSH
  - config

## Migration Strategy

Recommended migration style:

- strangle pattern
- parity-first
- keep n8n alive while code takes over bounded slices

Suggested order:

1. document contracts and state machine
2. extract shared pure logic into TypeScript
3. stand up new webhook application
4. migrate Telegram router
5. migrate payment creation and YooKassa webhook
6. migrate generation and delivery workers
7. cut over traffic

## Immediate Next Actions

1. Freeze and rotate secrets, especially Telegram token.
2. Capture the exact Postgres schema and enums.
3. Write a typed `BotSession` contract and event matrix.
4. Build the new TypeScript application alongside current workflows.
5. Move duplicated session and callback parsing logic into tested pure functions first.
