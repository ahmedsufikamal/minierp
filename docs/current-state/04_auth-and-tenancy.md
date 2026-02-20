# 04 Auth and Tenancy (AS-IS)

## Authentication stack
- Primary auth mode: IAM v2 local provider (`IAM_PROVIDER=local`)
- Session cookies:
  - `iam_session` (primary)
  - `session` (legacy fallback)
- Session verification paths:
  - UI/server helpers currently use `verifySession()` via `src/lib/session.ts`
  - API and platform context primarily use `resolvePrincipalFromTokens()`

## Current auth guard behavior
- `verifySession()` redirects unauthenticated requests:
  - IAM v2: redirect to `/auth/sign-in`
  - Legacy mode: redirect to `/sign-in`
- `requireAuth()` in IAM guards throws structured auth errors (`UNAUTHORIZED`, `MFA_REQUIRED`, etc.)
- `src/proxy.ts` enforces simple protected/public route redirects using cookie presence.

## Known auth coupling issue
- `src/app/layout.tsx` calls `getCurrentUser()`.
- `getCurrentUser()` calls `verifySession()`, which redirects when unauthenticated.
- Result: unauthenticated request to `/auth/sign-in` can redirect to itself (`307` loop).

## Tenant and company resolution
- Platform request context (`src/modules/platform/interface/context.ts`) resolves:
  - principal from cookies
  - requested company from `x-company-id` header or principal active company
  - membership check when switching company
  - tenant via company mapping (`resolveTenantForCompany`) and host check (`resolveTenantIdFromHost`)
- If host tenant and company tenant mismatch, non-super-admin requests are denied.

## Data-scoping model
- Services are expected to scope queries by `companyId` (and often `tenantId`) using `PlatformRequestContext`.
- Enforcement is mostly at service/query level, not database RLS.

## Session/CSRF notes
- Cookie session uses `httpOnly`, `sameSite=lax`, secure in production.
- Several account/IAM routes enforce same-origin checks (for example account preferences route).
- No single centralized CSRF token middleware observed; protection relies on same-origin and cookie policies for current routes.

## Security posture summary
- Positive:
  - Structured IAM/platform errors
  - Membership validation for company switching
  - Tenant-host consistency check in platform context
- Gaps/risk:
  - Global layout auth coupling causes public auth route instability
  - Scoping relies on disciplined per-service filters; no DB-level RLS enforcement yet
