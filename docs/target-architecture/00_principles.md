# 00 Principles

## Scope and migration strategy
- Keep the current Next.js frontend running.
- Migrate backend capabilities incrementally behind stable `/api/v1/*` contracts.
- No big-bang rewrite; each migrated slice must be reversible.

## Product architecture principles
- ERP is metadata-driven (DocType-like), not hardcoded form-by-form.
- Multi-tenant SaaS baseline uses shared schema with strict tenant and company scoping.
- Authorization is explicit and enforced server-side at every endpoint/data-access path.
- All mutating actions are auditable (append-only audit events).
- API contracts are versioned and treated as compatibility boundaries.

## Platform quality principles
- Contract-first API evolution (OpenAPI as source-of-truth for migrated slices).
- Observable-by-default services (request IDs, structured logs, health checks).
- Deterministic migrations and idempotent seed/bootstrap routines.
- Security defaults: least privilege RBAC, secure headers, rate limiting, and deny-by-default tenancy filters.

## Locked technical decisions (MVP)
- Rust API stack: Axum + SQLx.
- Auth in Rust: OIDC/JWT validation.
- Migration token source: internal IAM OIDC bridge from current app.
- Tenancy data strategy: single DB + shared schema + strict tenant/company scoping.
