# Stock Module AS-IS (2026-02-21)

## Scope inspected
- Routes:
  - `src/app/(app)/stock/overview/page.tsx`
  - `src/app/(app)/stock/items/page.tsx`
  - `src/app/(app)/stock/settings/page.tsx`
  - `src/app/(app)/stock/warehouses/page.tsx`
  - `src/app/(app)/stock/documents/page.tsx`
  - `src/app/(app)/stock/ledger/page.tsx`
  - `src/app/(app)/stock/reorder/page.tsx`
- APIs:
  - `src/app/api/stock/settings/route.ts`
  - `src/app/api/v1/inventory/*`
  - `apps/api-rust/src/main.rs`
- Data model:
  - `prisma/schema.prisma`

## Current route behavior
- Stock route wrappers currently re-export inventory pages:
  - `/stock/overview` -> inventory overview page
  - `/stock/items` -> inventory items workbench page
  - `/stock/settings` -> inventory settings page
- There is no dedicated canonical `/stock` page yet.
- Nav still points Stock overview to `/stock/overview`.

## Current UI state vs target
### `/stock/overview`
- Current UI is table-heavy operational inventory overview.
- Missing ERPNext-style stock workspace sections:
  - KPI cards row with `total_stock_value`, `total_warehouses`, `total_active_items`
  - Warehouse-wise stock value chart block
  - Quick access cards row
  - Masters & Reports grouped shortcut grid

### `/stock/items`
- Current UI is a generic inventory workbench with column toggles and saved views.
- Missing ERP list layout features:
  - Left filter sidebar (`Assigned To`, `Created By`, `Tags`, save filter)
  - ERP list actions/header controls and row action icon rail
  - URL-canonical query contract for filters + pagination
  - Variant/template filter semantics

### `/stock/settings`
- Existing settings tabs and form fields are already extensive and map closely to ERP-style stock settings.
- Missing layout/features:
  - Left meta actions rail (`Assigned To`, `Attachments`, `Share`)
  - Comments stream
  - Activity feed (audit + comment events) in right panel
- Current edit gate is permission-based; target for this pass is strict level-based writer gate (`>=4`).

## Current API state
- Existing Rust-backed stock endpoint:
  - `GET/PATCH/PUT /api/stock/settings` (proxied through Next route).
- Missing stock endpoints required for target UX:
  - `GET /api/stock/workspace/metrics`
  - `GET /api/stock/workspace/warehouse-stock-value`
  - `GET /api/stock/workspace/quick-access`
  - `GET /api/stock/items` (ERP list query contract)
  - `GET /api/stock/settings/activity`
  - `GET/POST /api/stock/settings/comments`

## Current data model state
- Existing inventory models already include:
  - `InventoryCompanySetting`, `InventoryWarehouse`, `InventoryLedgerEntry`, `InventoryStockBalance`, `InventoryAuditLog`.
- `InventoryCompanySetting` already includes ERP-grade stock settings fields and `version`.
- `Product` currently lacks fields needed for full ERP list filters:
  - `assignedTo`, `createdBy`, `isTemplate`, `variantOfId` (self relation).
- No dedicated item-tags model for stock item list filter by tags.
- No dedicated stock settings comment model.

## Auth and tenancy
- Inventory request context is resolved in `src/modules/inventory/interface/context.ts`.
- Company scoping and membership checks are applied for inventory context.
- Rust proxy forwards:
  - `x-minierp-company-id`, `x-minierp-tenant-id`, `x-minierp-user-id`, `x-minierp-user-level`, permissions, request-id, proxy secret.
- Target change for settings writes:
  - enforce level-based gate (`4/5/9`) on both Next adapter and Rust handler.

## Baseline check findings
- Logs: `docs/stock/logs/*`
- `npm ci`, `lint`, `typecheck`, `test:unit`, `cargo fmt/clippy/test` completed.
- `next build` failed in this environment with Turbopack sandbox permission error:
  - `Operation not permitted (os error 1)` while creating process/binding port.
- `prisma seed` failed because DB at `127.0.0.1:5432` was unreachable in this run.
- `npm run dev -- --port 3103` failed with local EPERM bind error in this environment; curls failed accordingly.

## Gap summary
1. Add canonical `/stock` workspace page and keep `/stock/overview` compatibility redirect.
2. Rebuild `/stock/items` to ERP list view and back it by a new `/api/stock/items` contract.
3. Expand `/stock/settings` into 3-column ERP shell with comments/activity.
4. Extend schema for item filters/tags and settings comments.
5. Add Rust stock workspace/items/comments/activity endpoints and Next proxy adapters.
6. Add tests for tenancy, filters, settings level-gating, and stock UI smoke.
