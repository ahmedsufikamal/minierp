# 01 Folder Map (AS-IS)

## Repository root
- `src/`: application code (frontend + backend route handlers + domain modules)
- `prisma/`: schema, migrations, seed
- `e2e/`: Playwright end-to-end tests
- `scripts/`: operational/utility scripts (IAM worker, parity scripts, audits)
- `docs/`: product and parity documentation
- `.github/workflows/`: CI workflows

## Source layout
- `src/app/`: Next App Router pages/layouts and API routes
  - `src/app/(app)/**`: authenticated app surfaces (ERP modules)
  - `src/app/auth/**`: auth UI pages
  - `src/app/api/**`: IAM/account/admin/session routes
  - `src/app/api/v1/**`: module APIs (accounting, inventory, CRM, etc.)
- `src/components/`: shared UI components and shell
- `src/lib/`: shared utilities (auth/session/prisma/runtime env/api clients)
- `src/modules/`: backend domain modules organized by bounded context
  - pattern: `application/`, `domain/`, `interface/`

## Module inventory (high-level)
- Core IAM/platform: `iam`, `platform`
- ERP domains: `accounting`, `buying`, `selling`, `inventory`, `projects`, `quality`, `support`, `hr`, `payroll`, `manufacturing`, `assets`, `maintenance`, `crm`, `pos`, `integrations`, `portal`, `regional`, `utilities`, `telephony`, `subcontracting`, `edi`, `bulk`

## Architectural boundaries
- UI/Route layer:
  - Next pages and route handlers in `src/app/**`
- Application services:
  - Business logic in `src/modules/*/application`
- Domain contracts:
  - Schemas/types/errors in `src/modules/*/domain`
- Interface adapters:
  - HTTP/context/auth adapters in `src/modules/*/interface`

## Data and migration artifacts
- Prisma schema: `prisma/schema.prisma`
- Migration history: `prisma/migrations/*`
- Seed entry: `prisma/seed.mjs`

## Testing layout
- Unit tests:
  - `src/**/__tests__/*.test.ts`
- Integration tests (DB-backed):
  - `src/**/__tests__/*.integration.test.ts`
- E2E tests:
  - `e2e/*.spec.ts`
