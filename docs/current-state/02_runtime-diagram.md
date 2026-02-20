# 02 Runtime Diagram (AS-IS)

```text
Browser
  |
  | HTTP request (cookies: iam_session/session, optional x-company-id)
  v
Next.js App (src/app)
  |
  |-- proxy.ts
  |    - protected/public route redirects
  |    - currently excludes /api from matcher
  |
  |-- App Router pages/layouts
  |    - src/app/layout.tsx (global layout)
  |    - src/app/(app)/layout.tsx (authenticated shell)
  |
  |-- Route Handlers
  |    - /api/* (IAM/account/admin)
  |    - /api/v1/* (ERP module APIs)
  v
Module interface adapters
  - src/modules/*/interface/http.ts
  - src/modules/platform/interface/context.ts
  |
  | resolve principal + company/tenant context
  v
Module application services
  - src/modules/*/application/*.service.ts
  |
  | Prisma queries/transactions
  v
Prisma Client (src/lib/prisma.ts)
  |
  v
PostgreSQL (DATABASE_URL)

Auxiliary runtime paths
- IAM queue/notifications: BullMQ -> Redis (optional; inline fallback)
- Object storage flows: MinIO/S3-compatible endpoints for inventory assets
- CI runtime: migrations + seed + tests from GitHub Actions jobs
```

## Auth flow (current)

```text
Request -> resolvePrincipalFromTokens
  -> iam_session verification (preferred)
  -> legacy session fallback (optional)
  -> requireAuth/requirePermission guards
```

## Tenant/company flow (current)

```text
Request -> getPlatformRequestContext
  -> principal.activeCompanyId or header x-company-id
  -> membership validation for requested company
  -> tenant resolution by company + host consistency check
  -> PlatformRequestContext { tenantId, companyId, userId, role, permissions }
```
