# Core V2 Server

This directory contains the production-oriented Core API skeleton.

## Layers

- config: environment and runtime configuration
- middleware: authentication, request IDs, errors and rate limits
- routes: HTTP API routes
- services: business logic
- providers: AI provider adapters
- db: PostgreSQL access and repositories
- utils: shared server utilities

The server must keep provider credentials and database credentials server-side.

The public API contract is defined in `docs/API-CONTRACT-V2.md`.
