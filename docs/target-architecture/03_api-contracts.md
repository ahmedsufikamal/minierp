# 03 API Contracts

## Stability rules
- Public client-facing paths remain `/api/v1/*`.
- Contract changes are additive unless a new version is introduced.
- Error envelope shape is stable:
  - `{ ok: false, error: { code, message, details? } }`

## Contract governance
- OpenAPI is required for each migrated slice before implementation cutover.
- Generated/typed contracts are consumed by frontend adapters and integration tests.
- Contract parity tests compare legacy and migrated responses for key scenarios.

## Internal migration bridge APIs
- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `POST /api/auth/token/exchange`

## Request metadata standards
- `x-request-id` must be accepted and propagated end-to-end.
- If absent, API generates one and returns it in response headers.
- Tenant switching headers (e.g., `x-company-id`) require membership validation.

## Cutover checklist per slice
1. Contract freeze + examples.
2. Rust implementation + tests.
3. Proxy switch for that slice.
4. Frontend verification and tenancy regression checks.
5. Rollback switch documented and tested.
