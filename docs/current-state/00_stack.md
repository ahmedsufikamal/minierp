# 00 Stack (AS-IS)

Generated from repository inspection and runtime checks on 2026-02-20.

## Package/runtime
- Package manager: `npm` (`package-lock.json` present)
- Node: `v22.13.0`
- npm: `11.5.2`
- TypeScript: `5.9.3`

## Frontend
- Framework: `Next.js 16.1.4`
- Router: App Router (`src/app/**`)
- UI: `React 19.2.3`, Tailwind CSS v4 (`@import "tailwindcss"` in `src/app/globals.css`)
- Theme: `next-themes` + custom sync component (`src/components/theme-preference-sync.tsx`)

## Backend (current)
- API style: Next.js Route Handlers under:
  - IAM/account: `src/app/api/**`
  - Domain APIs: `src/app/api/v1/**`
- Server-side logic:
  - Service-layer modules in `src/modules/*/{application,domain,interface}`
  - Some server actions in route segments (`src/app/(app)/**/actions.ts`)
- Proxy/middleware: `src/proxy.ts`

## Auth and session
- Auth provider: custom IAM v2 "local" provider (`src/modules/iam/infrastructure/provider.ts`)
- Session cookies:
  - `iam_session` (primary IAM cookie)
  - `session` legacy fallback cookie
- Principal resolution:
  - `resolvePrincipalFromCookies()` / `resolvePrincipalFromTokens()`
  - `requireAuth()` and permission guards in IAM module
- Public auth routes under `/auth/*`.

## Data layer
- Database: PostgreSQL
- ORM: Prisma (`prisma/schema.prisma`, `@prisma/client`)
- Migration strategy: SQL migrations in `prisma/migrations/*`
- Seed: `node prisma/seed.mjs`

## Multi-tenancy model (as implemented)
- Shared schema with tenant/company identifiers (`tenantId`, `companyId`)
- Request context resolution in `src/modules/platform/interface/context.ts`
- Company switching via `x-company-id` header with membership check

## Jobs and async
- Queue library present: `bullmq`
- IAM background worker script: `scripts/iam-worker.mjs`
- Queue abstraction supports inline fallback when Redis is absent

## Infra/deployment artifacts
- Local infra compose: `docker-compose.dev.yml`
  - Postgres 16
  - Redis 7
  - MinIO (+ init job)
- CI: `.github/workflows/ci.yml`
  - Quality, migration safety, integration tests, e2e (protected branch)

## Current Step 0 runtime findings
- Dev auth route issue reproduced: `/auth/sign-in` returns `307` to itself
- Production startup shows `500` on `/auth/sign-in` when required secret is missing (`INVENTORY_STORAGE_SIGNING_SECRET`)
- `lint`, `typecheck`, `unit tests`, and `build` pass
- Pending migrations detected
- Seed fails in this execution context with Prisma DB reachability error
