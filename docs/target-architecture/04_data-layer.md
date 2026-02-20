# 04 Data Layer

## MVP tenancy strategy (selected)
- Single PostgreSQL database, shared schema.
- Every tenant-bound table includes:
  - `tenant_id`
  - `company_id`
- Every query in migrated services is scoped by both IDs.

## Why this strategy now
- Fastest path for strangler migration without frontend disruption.
- Minimizes infra complexity while preserving strong isolation in app layer.
- Compatible with later hardening (Postgres RLS).

## Migration ownership
- Existing Prisma migrations remain source-of-truth for legacy Next handlers.
- Rust-owned schema changes use SQLx migrations in `apps/api-rust/migrations`.
- Migration order must be deterministic and deployment-safe.

## Data safety controls
- Idempotency keys for mutating endpoints.
- Unique constraints aligned with business invariants (numbering, natural keys).
- Audit/event outbox tables for side-effects and replay.

## Phase-2 hardening path
- Add Postgres RLS policies for tenant/company guards.
- Add periodic tenancy leak detection queries in CI/ops checks.
