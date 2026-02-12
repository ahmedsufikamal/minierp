# IAM v1 (Custom Identity + Access) for miniERP

## Overview
This repository includes a first-party IAM module at `src/modules/iam` with:

- Credentials auth (email/password)
- Magic links
- OTP (email/SMS)
- MFA (TOTP + recovery codes)
- OAuth2/OIDC social login (Google + Microsoft)
- Multi-tenant membership and active-tenant context
- Tenant-scoped RBAC (roles + permissions)
- Domain-based tenant resolution and tenant theming
- Session management (list/revoke/revoke-all, idle/absolute expiration)
- Platform and tenant audit logs
- Admin interfaces for tenant and platform operations

No external auth platform is required.

## Architecture
- `src/modules/iam/domain`: core contracts, types, permission catalog, error model.
- `src/modules/iam/application`: guards (`requireAuth`, `requirePermission`, etc.), policy evaluation, bootstrapping.
- `src/modules/iam/infrastructure`: Prisma-backed identity provider, session/OTP/TOTP/magic-link/OAuth, notification adapters, rate limiting, Turnstile.
- `src/modules/iam/interface`: shared Zod schemas and HTTP helpers.

Adapter boundary:
- `IdentityProviderAdapter` is defined in `src/modules/iam/domain/identity-provider.ts`.
- Current provider: `LocalIdentityProvider`.
- Provider resolver: `src/modules/iam/infrastructure/provider.ts` (via `IAM_PROVIDER`).

## Database
Prisma schema additions include:
- Tenant extensions on `Company`
- User extensions on `User`
- Membership extensions on `CompanyMembership`
- IAM tables: `IamRole`, `IamPermission`, `IamRolePermission`, `IamInvitation`, `IamAutoJoinRule`, `IamSession`, `IamMfaFactor`, `IamRecoveryCode`, `IamOtpChallenge`, `IamMagicLinkToken`, `IamOAuthAccount`, `IamAuditLog`, `IamLoginAttempt`, `IamImpersonationSession`

Migration added:
- `prisma/migrations/20260212100000_add_iam_v1/migration.sql`

## Required Environment Variables
Core:
- `DATABASE_URL`
- `JWT_SECRET` (legacy compatibility)
- `IAM_V2_ENABLED=1`
- `IAM_PROVIDER=local`
- `IAM_TOKEN_HASH_SECRET` (>=32 chars)
- `IAM_ENCRYPTION_SECRET` (>=32 chars)
- `NEXT_PUBLIC_APP_URL` (required in production, e.g. `https://erp.example.com`)
- `SESSION_COOKIE_DOMAIN` (optional, set for shared subdomain auth)
- `IAM_REQUIRE_SAME_ORIGIN=1` (recommended for production state-changing API routes)
- `IAM_LEGACY_FALLBACK_ENABLED=1` (migration bridge)
- `IAM_DUAL_WRITE_LEGACY_SESSION=1` (write both `iam_session` + legacy `session` during rollout)
- `IAM_LEGACY_FALLBACK_SUNSET_DAYS=30` (operational reminder window)
- `IAM_INVITE_SIGNUP_BRIDGE_ENABLED=1` (invite token sign-up/claim flow)
- `IAM_INVENTORY_PERMISSION_SYNC_ENABLED=1` (prefer IAM permissions in inventory APIs with compatibility aliases)
- `INVENTORY_STORAGE_SIGNING_SECRET` (>=32 chars in production)

OAuth:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_CLIENT_ID`
- `MICROSOFT_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_TENANT_ID` (optional, default `common`)

Notifications:
- `IAM_NOTIFICATION_PROVIDER=http` (or omit for no-op)
- `IAM_QUEUE_PROVIDER=inline|bullmq` (default `inline`)
- `REDIS_URL` (required when `IAM_QUEUE_PROVIDER=bullmq`)
- `IAM_QUEUE_NAME` (optional; default `iam-notifications`)
- `IAM_QUEUE_CONCURRENCY` (optional; worker concurrency)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_PHONE`

Bot protection:
- `IAM_TURNSTILE_ENABLED=1` (optional)
- `TURNSTILE_SECRET_KEY`

Rate limit mode:
- `IAM_RATE_LIMIT_MODE=db` (optional; production defaults to `db`, development defaults to in-memory)

API key transport policy:
- `API_KEY` and `API_ORG_ID` for `/api/v1/*`
- `API_KEY_QUERY_FALLBACK_ENABLED=1` during bridge window only
- `API_KEY_QUERY_SUNSET_DATE=2026-03-14` (default)
- `API_ALLOW_DEFAULT_ORG_FALLBACK=0` (set to `1` for local dev only if needed)

## Hardening Feature-Flag Matrix
- Bridge rollout start date: **February 12, 2026**
- Bridge sunset target date: **March 14, 2026**

| Flag | Purpose | Default During Bridge | Target After Sunset |
| --- | --- | --- | --- |
| `IAM_V2_ENABLED` | Use IAM v2 session/auth paths | `1` | `1` |
| `IAM_LEGACY_FALLBACK_ENABLED` | Accept legacy `session` cookie in IAM guards | `1` | `0` |
| `IAM_DUAL_WRITE_LEGACY_SESSION` | Write legacy + IAM cookies at auth completion | `1` | `0` |
| `IAM_INVITE_SIGNUP_BRIDGE_ENABLED` | Invite claim via sign-up bridge | `1` | `1` |
| `IAM_INVENTORY_PERMISSION_SYNC_ENABLED` | IAM-first inventory permission checks | `1` | `1` |
| `API_KEY_QUERY_FALLBACK_ENABLED` | Accept `apiKey` query parameter | `1` | `0` |

## Local Development
Infrastructure (already in repo):
```bash
docker compose -f docker-compose.dev.yml up -d
```

Install and generate:
```bash
npm install
npm run prisma:generate
```

Apply migrations and seed:
```bash
npm run prisma:migrate:dev -- --name iam_v1
npm run prisma:seed
npm run iam:backfill
```

Run web app:
```bash
npm run dev
```

Run IAM worker (required if using `IAM_QUEUE_PROVIDER=bullmq`):
```bash
npm run iam:worker
```

## Routes Added
Auth/UI:
- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/verify`
- `/auth/mfa`

Tenant/Admin UI:
- `/settings/account`
- `/org/select`
- `/org/new`
- `/org/settings`
- `/org/members`
- `/org/roles`
- `/admin`

APIs:
- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`
- `POST /api/auth/magic-link/send`
- `POST /api/auth/mfa/enroll`
- `POST /api/auth/mfa/verify`
- `POST /api/auth/mfa/recovery/verify`
- `POST /api/auth/session/bridge`
- `GET /api/auth/config`
- `GET /api/sessions`
- `POST /api/sessions/revoke`
- `POST /api/sessions/revoke-all`
- `GET/POST /api/orgs`
- `GET/PATCH/DELETE /api/orgs/{id}`
- `GET/PUT/DELETE /api/orgs/{id}/members`
- `POST /api/orgs/{id}/invites`
- `POST/GET /api/invites/accept`
- `GET /api/invites/preview?token=...`
- `POST /api/invites/claim`
- `GET/POST /api/orgs/{id}/roles`
- `PATCH/DELETE /api/orgs/{id}/roles/{roleId}`
- `GET/POST /api/orgs/{id}/auto-join-rules`
- `PATCH/DELETE /api/orgs/{id}/auto-join-rules/{ruleId}`
- `GET /api/orgs/{id}/permissions`
- `GET /api/audit`
- OAuth: `/api/auth/oauth/{google|microsoft}/{start|callback}`
- `PATCH /api/account/profile`
- `POST /api/account/email/change/send-otp`
- `POST /api/account/phone/verify/send`
- `POST /api/account/phone/verify/confirm`
- `POST /api/account/password/change`
- `POST /api/account/password/reset`
- `POST /api/admin/tenants/{id}/disable`
- `POST /api/admin/tenants/{id}/force-logout`
- `POST /api/admin/tenants/{id}/force-mfa`
- `POST /api/admin/users/{id}/force-password-reset`
- `POST /api/admin/impersonation/start`
- `POST /api/admin/impersonation/stop`
- `POST /api/orgs/{id}/domains/verification-token`
- `POST /api/orgs/{id}/domains/verify`

## How To
Create roles/permissions:
- Go to `/org/roles` and create role with permission keys.

Enforce MFA:
- Go to `/org/settings` and set MFA mode.
- User enrolls and verifies at `/auth/mfa`.

Configure domains/theming:
- Go to `/org/settings` and set `primaryDomain`, `allowedDomains`, and brand tokens.
- Theme loads in `src/app/layout.tsx` via host/active tenant resolution.

Enable social sign-on:
- Set Google/Microsoft env vars.
- Use sign-in buttons on `/auth/sign-in`.

Queue-backed notifications:
- Set `IAM_QUEUE_PROVIDER=bullmq` and `REDIS_URL`.
- Start the worker with `npm run iam:worker`.
- Keep `IAM_NOTIFICATION_PROVIDER=http` to deliver through Resend/Twilio from the worker.

Rotate secrets:
- Rotate `IAM_TOKEN_HASH_SECRET` and `IAM_ENCRYPTION_SECRET` with planned session/token invalidation.

## Testing
Unit:
```bash
npm run test:unit
```

Integration (requires PostgreSQL reachable from `DATABASE_URL`):
```bash
npm run test:integration
```

Combined suite:
```bash
npm run test
```

E2E (Playwright):
```bash
npm run test:e2e
```

Typecheck and lint:
```bash
npm run typecheck
npm run lint
```

## Production Checklist
- Enable HTTPS and secure cookie deployment.
- Keep `NEXT_PUBLIC_APP_URL`, IAM secrets, and storage signing secret set; startup fails in production if required values are missing.
- Set strict `NEXT_PUBLIC_APP_URL` and domain mappings.
- Enable Turnstile and edge/WAF rate limiting.
- Run at least one IAM worker replica when `IAM_QUEUE_PROVIDER=bullmq`.
- Configure notification provider credentials.
- Monitor IAM audit logs and define retention/export policy.
- Define key rotation policy for IAM secrets.
- Backup PostgreSQL and validate restore procedures.
- Enforce CI quality gates (`typecheck`, `lint`, `test`, `build`) and migration safety checks before deploy.

## Bridge Sunset Checklist (March 14, 2026)
Execute this checklist on or after **March 14, 2026**:

1. Set `IAM_LEGACY_FALLBACK_ENABLED=0`.
2. Set `IAM_DUAL_WRITE_LEGACY_SESSION=0`.
3. Set `API_KEY_QUERY_FALLBACK_ENABLED=0`.
4. Redeploy and monitor auth/session error rates for at least 24 hours.
5. Remove bridge code paths in a cleanup PR:
   - Legacy session fallback resolution.
   - Dual-write legacy cookie behavior.
   - Query-string API key compatibility branches.
6. Re-run full gates:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run test:e2e`
