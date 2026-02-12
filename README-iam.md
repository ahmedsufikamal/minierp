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
- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)

OAuth:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_CLIENT_ID`
- `MICROSOFT_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_TENANT_ID` (optional, default `common`)

Notifications:
- `IAM_NOTIFICATION_PROVIDER=http` (or omit for no-op)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_PHONE`

Bot protection:
- `IAM_TURNSTILE_ENABLED=1` (optional)
- `TURNSTILE_SECRET_KEY`

Rate limit mode:
- `IAM_RATE_LIMIT_MODE=db` (optional; default in-memory)

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
```

Run web app:
```bash
npm run dev
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
- `GET /api/sessions`
- `POST /api/sessions/revoke`
- `POST /api/sessions/revoke-all`
- `GET/POST /api/orgs`
- `GET/PATCH/DELETE /api/orgs/{id}`
- `GET/PUT/DELETE /api/orgs/{id}/members`
- `POST /api/orgs/{id}/invites`
- `POST/GET /api/invites/accept`
- `GET/POST /api/orgs/{id}/roles`
- `PATCH/DELETE /api/orgs/{id}/roles/{roleId}`
- `GET /api/orgs/{id}/permissions`
- `GET /api/audit`
- OAuth: `/api/auth/oauth/{google|microsoft}/{start|callback}`

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

Rotate secrets:
- Rotate `IAM_TOKEN_HASH_SECRET` and `IAM_ENCRYPTION_SECRET` with planned session/token invalidation.

## Testing
Unit and integration:
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
- Set strict `NEXT_PUBLIC_APP_URL` and domain mappings.
- Enable Turnstile and edge/WAF rate limiting.
- Configure notification provider credentials.
- Monitor IAM audit logs and define retention/export policy.
- Define key rotation policy for IAM secrets.
- Backup PostgreSQL and validate restore procedures.
