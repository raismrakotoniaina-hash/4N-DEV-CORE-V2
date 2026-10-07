# 4N DEV Core — Database Layer V2

This directory contains the PostgreSQL connection and repository layer.

## Production data

The schema is defined in:

- `migrations/001_initial.sql`

Repositories intentionally keep SQL outside HTTP routes.

## Current repositories

- `api-keys.js` — API key lookup, creation and revocation.
- `credits.js` — credit balance and transactional usage charging.

## Configuration

Set `DATABASE_URL` on the production server.

Do not commit database credentials or API key pepper values.

## Important

The migration is a production schema foundation. It is not automatically executed by the API process yet. A dedicated migration/deployment step should run it before production traffic is enabled.
