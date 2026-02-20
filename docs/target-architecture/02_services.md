# 02 Services

## Workspace layout
- `apps/api-rust`: Axum API service for migrated slices.
- `crates/domain`: shared value objects and invariants.
- Future crates (planned):
  - `crates/authz`
  - `crates/audit`
  - `crates/workflow`
  - `crates/reporting`

## Runtime service boundaries
- Next.js app:
  - UI rendering, temporary API host, IAM bridge endpoints, proxy adapter.
- Rust API:
  - Migrated `/api/v1/*` slice implementations.
  - Tenancy and authorization enforcement for migrated slices.
  - OpenAPI publication and typed error envelopes.

## Request path during strangler phase
1. Frontend calls `/api/v1/*` (unchanged path).
2. Next adapter decides route owner:
   - legacy TS handler, or
   - Rust upstream via proxy.
3. Adapter forwards `Authorization` + `x-request-id`.
4. Rust validates JWT via OIDC bridge and applies tenancy guards.

## Non-functional defaults
- Structured JSON logs with request correlation.
- Health endpoint includes dependency status.
- Migrations are owned by service that writes the schema (`sqlx migrate` for Rust-owned changes).
