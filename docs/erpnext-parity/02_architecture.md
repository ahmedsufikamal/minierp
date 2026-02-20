# miniERP Architecture

## Current State (Observed In Repo)

### Runtime and app structure
- Framework: Next.js App Router + React + TypeScript.
- API style: route handlers and server actions.
- Middleware/proxy gate: `src/proxy.ts`.

### Data and persistence
- Primary DB: PostgreSQL.
- ORM: Prisma (`prisma/schema.prisma`, `src/lib/prisma.ts`).
- Current multi-company model: `Company` + `CompanyMembership`.
- Current tenant-like behavior: company-scoped (`companyId` mapped as `orgId`) on business tables.

### Auth and access control
- Custom IAM v2 module in `src/modules/iam/*`.
- Features: sessions, MFA, OTP, magic links, OAuth, invite flows, platform-admin controls, impersonation.
- Permission model: `IamPermission`, `IamRole`, `IamRolePermission` with role defaults in `src/modules/iam/domain/permissions.ts`.

### Inventory module (most mature)
- Domain/application/interface/infrastructure split in `src/modules/inventory/*`.
- Includes inventory workflows, custom fields, label templates, import/export jobs, audit log, and posting.

### Queue/jobs
- BullMQ optional runtime with inline fallback.
- Worker entrypoint for IAM exists (`scripts/iam-worker.mjs`).

### Test/quality baseline
- Lint: ESLint.
- Format: Prettier scripts (`npm run format`, `npm run format:check`).
- Unit/integration: Vitest.
- E2E: Playwright.
- CI pipeline present in `.github/workflows/ci.yml`.

## Target State (Phase 1 Platform)

### 1) Multi-tenancy strategy
- Shared database, explicit `tenantId` + `companyId` on tenant-scoped transactional entities.
- `Tenant` becomes top-level account boundary; `Company` belongs to one tenant.
- `TenantDomain` maps hostnames to tenants.
- Resolution order:
  1. Host/domain match (`TenantDomain`, fallback company domain)
  2. Session principal context
  3. Explicit request header for company switch (with membership validation)

### 2) Security and authorization
- Keep IAM identity provider and session stack.
- Add scope-aware authorization layer:
  - Resource + action + scope dimensions.
  - Row-level scoping rules evaluated centrally.
- Defensive model:
  - App-level authorization checks mandatory.
  - DB-level hardening (RLS or guarded views) first for critical ledger paths.

### 3) Workflow and approvals engine
- Generic workflow engine for all modules with:
  - State definitions
  - Transition rules
  - Approval requirements and quorum
  - Audit trail for state changes
- Inventory workflow becomes an adapter/consumer of generic engine.

### 4) Audit, immutable ledger, and outbox
- `AuditEvent`: queryable human-readable event timeline.
- `ImmutableLedgerEvent`: append-only hash chain for critical accounting/inventory events.
- `OutboxEvent`: reliable event publishing for async integrations and notifications.

### 5) Numbering series engine
- Central allocator service.
- Per-tenant/per-company series keys.
- Fiscal/yearly/monthly reset options.
- Atomic increments with transaction-safe conflict handling.

### 6) Reporting platform
- Metadata-driven report catalog.
- Safe query abstraction over approved report sources.
- Saved views + filters + exports.
- Scheduled report delivery hooks.

### 7) No-code customization layer
- Cross-module metadata definitions for:
  - custom fields
  - form layout
  - validation rules
  - workflow assignment
  - print templates
  - automation triggers/actions

### 8) Realtime and caching
- Cache strategy:
  - scoped cache keys include `tenantId` + `companyId`.
  - invalidate on outbox domain events.
- Realtime notifications:
  - initially polling + notification feed table.
  - websocket/SSE hook points later.

## Deployment and operations
- Keep current deployment model (Next.js app + Postgres + optional Redis worker).
- Add migration/backfill process for tenant introduction with compatibility bridge.
- Add observability for:
  - auth and policy denials
  - workflow transitions
  - immutable ledger verification failures
  - report query latency

## Data isolation and indexing
- Index pattern baseline on high-volume tables:
  - `(tenantId, companyId, createdAt)`
  - `(tenantId, companyId, status)`
  - module-specific dimensions (warehouse, project, fiscal period).
- Pagination required on list/report endpoints.

## Legal and compliance constraints
- ERPNext/Frappe docs are functional references only.
- No ERPNext source code copying.
- GPLv3 and ERPNext trademark constraints must remain documented for future contributors.
