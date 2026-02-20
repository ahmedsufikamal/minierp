# Inventory User Flows (AS-IS)

## Happy paths (currently implemented)

### 1) Overview
- User opens `/stock/overview` (redirect target for `/inventory`).
- Page renders counts for items, warehouses, docs, open docs, reorder rules using company-scoped queries.

### 2) Items
- User opens `/stock/items`.
- List/workbench renders searchable rows and dynamic custom columns.
- User creates item from `/inventory/items/new` form:
  - POST `/api/v1/inventory/items`
  - creates `Product` + identifiers + optional custom fields.
- Item detail page `/inventory/items/[id]` shows identifiers, balances, and ledger history.

### 3) Warehouses
- User opens `/stock/warehouses`.
- Creates warehouse via POST `/api/v1/inventory/warehouses`.
- Creates location via POST `/api/v1/inventory/locations`.
- Warehouse detail page shows location tree and stock context.

### 4) Documents (movement source-of-truth)
- User opens `/stock/documents`.
- Creates document from `/inventory/documents/new` (RECEIPT/ISSUE/TRANSFER/ADJUSTMENT/COUNT).
- Workflow actions run from doc detail:
  - SUBMIT -> APPROVE -> POST
  - posting writes ledger entries and updates stock balances transactionally.

### 5) Ledger
- User opens `/stock/ledger`.
- Filters by item/warehouse and views immutable posting rows.

### 6) Reorder
- User opens `/stock/reorder`.
- Creates reorder rule via POST `/api/v1/inventory/reorder-rules`.
- Runs suggestions via `/api/v1/inventory/reorder-suggestions`.

### 7) Settings
- User opens `/stock/settings`.
- Can currently manage custom fields, workflows, label templates.

## Broken/fragile paths observed in audit

### A) Cold install runtime crash before Prisma client generation
- Fixed in this pass.
- `npm ci` now executes `postinstall -> prisma:generate`, removing the manual generate requirement.
- Evidence:
  - `docs/inventory-audit/logs/33_npm_ci_postinstall.log`

### B) Seed workflow currently unstable
- Seed currently fails with DB constraint conflict (`P2002` on `CompanyMembership.companyId`) in this DB state.
- Evidence: `docs/inventory-audit/logs/17_prisma_seed.log`.

### C) Migration drift still present
- Unapplied migrations detected (theme preference + phase3 accounting baseline).
- Evidence: `docs/inventory-audit/logs/15_prisma_migrate_status.log`.

### D) Route path inconsistency for inventory
- `/inventory/*` is redirected to `/stock/*` via Next redirects.
- Functionally works, but creates dual-route coupling and can confuse debugging/e2e targeting.

## Automated smoke coverage added
- `tests/e2e/smoke/inventory-flows.spec.ts` now covers:
  1. Create Item
  2. Create Warehouse
  3. Receive stock (RECEIPT)
  4. Transfer stock
  5. Adjustment
  6. Ledger/balance verification
- Evidence:
  - `docs/inventory-audit/logs/38_test_e2e_smoke.log`
