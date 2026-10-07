# 4N DEV Core V2 — Official Architecture

## 1. Role of Core

4N DEV Core is the centralized AI API engine of the 4N DEV ecosystem.

Independent applications do not live inside Core. Each application consumes Core services through a dedicated `4ndev_sk_...` API key.

Core is responsible for AI execution, authentication/authorization, API-key lifecycle, credits, usage metering, model routing, rate limits and developer-facing API contracts.

## 2. High-level architecture

Developer Console
→ Developer account/session
→ API key management
→ 4N DEV Core API
→ authentication + authorization
→ service router
→ Chat / Coding / Image / future AI services
→ provider/model adapter
→ usage + credit ledger
→ response

Persistent infrastructure:
- PostgreSQL for developers, workspaces, API keys, plans, credits, usage and billing records.
- Secure secret storage for provider credentials.
- Application logs and audit events.
- Optional queue/cache/rate-limit layer when scale requires it.

## 3. Security model

Developer authentication and API-key authentication are separate concepts.

Console authentication:
- account email/password
- secure server-side session
- password hashing
- password reset
- optional MFA
- logout/session revocation

Core API authentication:
- `Authorization: Bearer 4ndev_sk_...`
- API keys are scoped to a workspace/environment.
- Store only a hash of the full secret after creation.
- Show the full secret only once.
- Revoke keys immediately.
- Never expose provider API keys to client applications.

## 4. Official API surface

Base URL will be configured when the production Core server is provisioned.

Public API:
- `POST /v1/chat`
- `POST /v1/coding`
- `POST /v1/image`
- `GET /v1/credits`
- `GET /v1/usage`
- `GET /v1/models`

Management API:
- `/api/auth/*`
- `/api/keys/*`
- `/api/projects/*`
- `/api/billing/*`
- `/api/dashboard`

The production implementation must keep the public `/v1/*` contract stable once released.

## 5. Request contract

Every authenticated AI request should include:
- Bearer API key
- service-specific JSON body
- optional client request metadata

Every successful AI response should provide:
- `success: true`
- `request_id`
- `service`
- `model`
- `usage`
- `data`

Every error should provide:
- `success: false`
- `error.code`
- `error.message`
- `request_id`

## 6. Credits

Credits are enforced server-side before provider execution.

The ledger must record:
- developer/workspace
- API key
- service
- request ID
- credits charged
- timestamp
- success/failure
- model/provider metadata where appropriate

A failed request must not silently consume credits unless the final billing policy explicitly defines otherwise.

Current documented service costs:
- Chat: 1 credit/request
- Coding: 8 credits/request
- Image: 50 credits/image

These values are configuration, not hard-coded business logic.

## 7. Model routing

Applications request a Core service, not a provider credential.

Core decides the model/provider through server-side configuration.

Therefore:
- application code must not depend on provider API keys;
- provider model identifiers remain internal unless explicitly exposed through the public model contract;
- changing provider infrastructure should not require changing every 4N DEV application.

## 8. Independent applications

Examples of future applications:
- N-AI Chat
- 4N DEV E-commerce
- future developer/productivity applications

Each remains an independent product/repository.

The relationship is:

Application → 4ndev_sk API key → 4N DEV Core → AI service

Not:

Application → embedded Core application

## 9. Production phases

Phase A — contract and architecture
- This document
- API schemas
- security rules
- database schema

Phase B — Core server
- PostgreSQL
- developer auth
- API keys
- credits/usage
- service router
- provider adapters

Phase C — production integrations
- Chat
- Coding
- Image
- billing/payment
- rate limits
- observability

Phase D — ecosystem
- connect independent applications
- SDKs
- webhooks
- advanced usage analytics

## 10. Non-goals

Core must not:
- contain the UI/application logic of every 4N DEV product;
- expose provider secrets;
- make applications dependent on a specific AI provider;
- treat the Developer Console API key field as the primary login mechanism.

## 11. Production rule

Before implementing production backend code, the database schema and public API request/response schemas should be reviewed against this architecture.

This document is the source of truth for the Core V2 architecture until superseded by a newer version.
