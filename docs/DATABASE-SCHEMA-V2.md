# 4N DEV Core V2 — Database Schema

## 1. Purpose

This schema defines the persistent data model for the production Core server.

The database is designed around:
- developers
- workspaces
- sessions
- API keys
- plans
- credit balances and ledger entries
- usage records
- projects
- billing records
- audit events

PostgreSQL is the target production database.

## 2. Entity relationships

Developer
→ owns Workspaces
→ has Sessions
→ can belong to multiple Workspaces

Workspace
→ owns API Keys
→ has one current Plan
→ has Credit Balance
→ owns Projects
→ generates Usage
→ generates Credit Ledger entries
→ owns Billing records

API Key
→ belongs to one Workspace
→ generates authenticated Usage
→ can generate Credit Ledger entries

Project
→ belongs to one Workspace

Audit Event
→ records security and important management actions.

## 3. developers

Primary identity of a Developer Console account.

Fields:
- id UUID primary key
- email unique, normalized lowercase
- password_hash
- display_name
- status: active | suspended | deleted
- email_verified_at nullable
- created_at
- updated_at
- last_login_at nullable

Rules:
- Never store plaintext passwords.
- Email uniqueness is case-insensitive.
- Deleted accounts must not be silently reused.

## 4. sessions

Server-side Developer Console sessions.

Fields:
- id UUID primary key
- developer_id UUID foreign key
- token_hash
- expires_at
- created_at
- last_seen_at
- revoked_at nullable
- ip_hash nullable
- user_agent nullable

Rules:
- Store only a session-token hash.
- Revocation must invalidate the session immediately.
- Expired sessions are unusable.

## 5. workspaces

Billing and API ownership boundary.

Fields:
- id UUID primary key
- developer_id UUID foreign key
- name
- slug unique
- type: personal | organization
- status: active | suspended | deleted
- plan_id foreign key
- created_at
- updated_at

Future organization support can add membership tables without changing API-key ownership.

## 6. workspace_members

Prepared for future team workspaces.

Fields:
- id UUID primary key
- workspace_id UUID foreign key
- developer_id UUID foreign key
- role: owner | admin | developer | viewer
- status: active | invited | suspended
- created_at
- updated_at

A personal workspace has one owner initially.

## 7. api_keys

Server-side representation of `4ndev_sk_...` credentials.

Fields:
- id UUID primary key
- workspace_id UUID foreign key
- name
- key_prefix
- key_hash
- environment: live | test
- status: active | revoked
- last_used_at nullable
- expires_at nullable
- created_at
- revoked_at nullable

Rules:
- Never store the full secret.
- Generate the secret once.
- Return the full secret only during creation.
- Store a cryptographic hash for verification.
- Prefix is safe for dashboard display.

## 8. plans

Commercial plan definitions.

Fields:
- id UUID primary key
- code unique
- name
- monthly_credits
- price_amount
- currency
- status: active | archived
- created_at
- updated_at

Credit prices for individual services should be configurable rather than embedded in application code.

## 9. plan_service_prices

Per-service credit cost configuration.

Fields:
- id UUID primary key
- plan_id UUID foreign key
- service: chat | coding | image | future_service
- credit_cost
- active
- created_at
- updated_at

Initial documented values:
- chat: 1
- coding: 8
- image: 50

These are configuration values and may change without changing API code.

## 10. credit_accounts

Current credit balance for a workspace.

Fields:
- id UUID primary key
- workspace_id UUID unique foreign key
- balance
- monthly_limit
- monthly_used
- reset_at
- updated_at

Rules:
- Balance changes must be represented in the credit ledger.
- Balance must never become negative.
- Concurrent requests require transactional locking/atomic updates.

## 11. credit_ledger

Immutable financial-style record of credit movements.

Fields:
- id UUID primary key
- workspace_id UUID foreign key
- api_key_id UUID nullable foreign key
- request_id nullable
- type: grant | usage | refund | adjustment | expiration
- amount
- balance_after
- service nullable
- description
- created_at

Rules:
- Do not edit historical ledger entries.
- Corrections use a new adjustment/refund entry.
- Every chargeable AI request must be traceable to a ledger entry.

## 12. usage_records

One record per Core API request.

Fields:
- id UUID primary key
- request_id unique
- workspace_id UUID foreign key
- api_key_id UUID foreign key
- service
- model nullable
- provider nullable
- status: success | error | rejected
- credits_charged
- input_units nullable
- output_units nullable
- latency_ms nullable
- error_code nullable
- created_at

Rules:
- `request_id` is returned to API clients.
- Usage must be queryable by workspace, service, API key and time range.
- Provider secrets never belong in this table.

## 13. projects

Developer-owned projects managed through Core.

Fields:
- id UUID primary key
- workspace_id UUID foreign key
- name
- slug
- description nullable
- status: active | archived
- created_at
- updated_at

Projects remain independent application resources; they do not contain application code unless a future product explicitly defines that capability.

## 14. billing_customers

External billing identity.

Fields:
- id UUID primary key
- workspace_id UUID unique foreign key
- provider
- external_customer_id
- status
- created_at
- updated_at

No payment secrets should be stored here.

## 15. billing_transactions

Payment/subscription records.

Fields:
- id UUID primary key
- workspace_id UUID foreign key
- provider
- external_transaction_id nullable
- external_reference nullable
- type: payment | subscription | refund | adjustment
- status: pending | completed | failed | cancelled
- amount
- currency
- metadata JSONB
- created_at
- updated_at

Provider-specific webhook fields must be normalized into this model while preserving safe raw metadata when required for reconciliation.

## 16. audit_events

Security and management audit trail.

Fields:
- id UUID primary key
- developer_id nullable UUID
- workspace_id nullable UUID
- event_type
- target_type nullable
- target_id nullable
- metadata JSONB
- created_at
- ip_hash nullable

Examples:
- login_success
- login_failed
- logout
- api_key_created
- api_key_revoked
- password_changed
- workspace_updated
- billing_updated

## 17. Database constraints

Production implementation should enforce:
- UUID primary keys
- foreign-key integrity
- unique developer email
- unique workspace slug
- unique API key prefix where required
- unique usage request_id
- non-negative credit balances
- non-negative credit costs
- valid status values
- timestamps in UTC

## 18. Transactions

The following operations must be transactional:

### AI request charge
1. Authenticate API key.
2. Resolve workspace and plan.
3. Resolve service credit cost.
4. Verify available credits.
5. Reserve/deduct credits atomically.
6. Create usage/ledger linkage.
7. Execute provider request.
8. Finalize usage.
9. Refund according to the final failure policy when required.

### API key creation
1. Generate secret.
2. Hash secret.
3. Store key metadata and hash.
4. Return secret once.

### Payment confirmation
1. Validate webhook authenticity.
2. Resolve external transaction.
3. Ensure idempotency.
4. Mark transaction status.
5. Apply the corresponding credit/billing change once.

## 19. Idempotency

Payment webhooks and other externally retried operations must be idempotent.

Recommended unique identifiers:
- external transaction ID
- provider reference
- request ID
- future Idempotency-Key for chargeable management operations

Repeated webhook delivery must never duplicate credits.

## 20. What is intentionally not finalized

The following remain deployment/configuration decisions:
- exact PostgreSQL hosting
- migration tool
- connection pooling configuration
- production Redis/cache
- exact billing provider implementation
- exact provider/model adapters
- retention periods
- log/observability vendor

These decisions must not change the public Core API contract unnecessarily.

## 21. Source of truth

This document defines the intended persistent data model for Core V2.

Production migrations should implement this model incrementally and preserve backward compatibility once public API traffic begins.
