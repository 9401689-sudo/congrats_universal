# Congrats: Migration Plan

## Goal

Move the current n8n-based Telegram bot platform into a maintainable TypeScript backend without losing behavior across:

- Telegram conversation flow
- Redis session state
- request lifecycle in Postgres
- YooKassa payment processing
- preview generation
- delayed delivery

## Target Stack

- Node.js 22
- TypeScript
- Fastify
- Redis
- Postgres
- BullMQ
- optional grammY adapter for Telegram

## Architecture Shape

Recommended form:

- modular monolith

Why:

- one deployable artifact
- easier parity with current n8n orchestration
- simpler observability and rollback
- lower migration risk than microservices

## Workstreams

### Workstream 1: Contracts and Reverse Engineering

Deliverables:

- session schema
- event schema
- callback command matrix
- Postgres entity map
- external integration inventory

Definition of done:

- every workflow has a matching use case or adapter destination in code

### Workstream 2: Platform Skeleton

Deliverables:

- application bootstrap
- config module
- webhook server
- health endpoint
- Redis and Postgres client wrappers
- job queue foundation

Definition of done:

- project starts locally
- app can load configuration and serve HTTP

### Workstream 3: Core Domain and FSM

Deliverables:

- `BotSession` type
- Telegram event normalizer
- callback parser
- explicit bot event router
- session update helpers

Definition of done:

- pure domain layer exists without n8n dependencies
- covered by unit tests

### Workstream 4: Telegram User Flow Migration

Deliverables:

- `/start`
- recipient name input
- intro menu
- preview generation commands
- seal pick
- tariff choice
- timezone choice/change
- email capture
- delivery username/manual choice

Definition of done:

- happy-path user flow works fully in code against current DB/Redis

### Workstream 5: Payments

Deliverables:

- YooKassa payment creation service
- idempotence handling
- payment persistence
- YooKassa webhook handler

Definition of done:

- payment initiation and webhook continuation work without n8n

### Workstream 6: Rendering and Delivery

Deliverables:

- queue-driven preview generation
- queue-driven final document generation
- scheduled delivery worker
- SSH rendering adapter

Definition of done:

- tariffs `149` and `199` both complete end-to-end in code

## Suggested Sprint Plan

### Sprint 1

- freeze current behavior and contracts
- finalize target module boundaries
- scaffold TypeScript app
- implement typed session and event normalization
- extract callback parser and core event router

### Sprint 2

- implement repositories for users/requests/payments/deliveries
- migrate `/start`, recipient flow, intro flow
- migrate generation trigger path and selected variant path
- add Telegram adapter and message builders

### Sprint 3

- migrate payment creation
- migrate timezone/email/delivery branches
- migrate YooKassa webhook
- add queue skeleton for rendering and delivery

### Sprint 4

- migrate scheduler and worker
- connect SSH rendering adapter
- run shadow mode checks
- cut over traffic

## Cutover Strategy

Recommended cutover:

- partial cutover by bounded flow, not by environment-wide switch

Example order:

1. code handles Telegram normalize + routing, n8n still handles payments/rendering
2. code handles payment initiation
3. code handles YooKassa webhook
4. code handles scheduled delivery
5. remove n8n from production path

## Technical Decisions

### Session Storage

Keep Redis first.

Reason:

- current workflows already depend on Redis session patterns
- lowest-risk migration path

### Database Access

Use SQL-first repositories first.

Reason:

- current behavior is encoded in SQL already
- parity is easier to maintain than with an ORM rewrite

### Queues

Use BullMQ.

Reason:

- preview generation and delayed delivery are queue-shaped problems
- Redis is already present

### Rendering

Keep SSH rendering as adapter in phase 1.

Reason:

- avoids coupling migration to rendering rewrite

## Acceptance Checklist

- Telegram update deduplication preserved
- session schema preserved
- callback commands preserved
- request state transitions preserved
- payment idempotency preserved
- tariff `149` immediate finalization preserved
- tariff `199` delayed delivery preserved
- timezone and email capture preserved
- inline keyboard cleanup preserved

## Open Inputs Still Needed

- actual Postgres DDL
- n8n credentials mapping
- SSH target details
- render asset locations
- production environment variables
- whether there is a separate PROD router export in addition to current DEV router
