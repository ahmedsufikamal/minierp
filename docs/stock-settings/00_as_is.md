# Stock Settings AS-IS

## Scope
- Module scope: `Stock > Settings` only.
- Canonical UI route: `/stock/settings` (wrapper) -> `src/app/(app)/inventory/settings/page.tsx`.
- Canonical API route: `/api/stock/settings` -> `src/app/api/stock/settings/route.ts`.

## Runtime architecture
- Frontend: Next.js App Router (`src/app`), React client form in `src/app/(app)/inventory/settings/settings-client.tsx`.
- API gateway layer: Next route handler calls Rust via `src/modules/inventory/interface/rust-stock-settings-proxy.ts`.
- Rust backend: Axum service in `apps/api-rust/src/main.rs`, endpoints:
  - `GET /api/stock/settings`
  - `PATCH /api/stock/settings`
  - `PUT /api/stock/settings`
- Persistence: Postgres via Prisma schema authority and SQLx runtime access.

## Data model (current)
- `InventoryCompanySetting` (one row per company via `companyId @unique`, DB column `orgId`):
  - Legacy compatibility fields retained (`costingMethod`, `preventNegativeStock`, etc.).
  - ERP-grade settings fields added (defaults, validations, reservation, serial/batch, planning, stock closing).
  - Concurrency fields: `version`, `updatedBy`, timestamps.
- `InventoryCostLayer`:
  - FIFO valuation layers keyed by company/item/warehouse/location.
- Check constraints in migration:
  - `overDeliveryReceiptAllowancePct`, `overTransferAllowancePct`, `overPickingAllowancePct` in `[0,100]`.
  - `freezeStocksOlderThanDays >= 0`.

## Auth and tenancy enforcement
- Next inventory context resolver: `src/modules/inventory/interface/context.ts`.
  - Auth via IAM session cookies or API key compatibility path.
  - Company context from active membership (`x-company-id` validated against membership).
  - Tenant/company values forwarded into inventory context.
- Write permission enforcement:
  - Next route checks `inventory.settings.write`.
  - Rust handler enforces write via `x-minierp-permissions`.
- Rust trusted proxy enforcement:
  - `x-minierp-proxy-secret` required when `RUST_TRUSTED_PROXY_SECRET` is configured.

## Current UI structure
- ERP-style tabbed settings page implemented with 6 tabs:
  - `Defaults`
  - `Stock Validations`
  - `Stock Reservation`
  - `Serial & Batch Item`
  - `Stock Planning`
  - `Stock Closing`
- Read-only mode when user lacks `inventory.settings.write`.
- Versioned save with `If-Match` and optimistic concurrency conflict handling.
- Dirty-state navigation/unload protection implemented.

## Current enforcement points in inventory flows
- Negative stock rule:
  - `src/modules/inventory/domain/posting.ts`
  - `src/modules/inventory/application/documents.service.ts`
- Freeze window rule:
  - `src/modules/inventory/application/stock-settings.service.ts`
  - `src/modules/inventory/application/documents.service.ts`
- Reservation toggle impact on availability:
  - `src/modules/inventory/application/reorder.service.ts`
  - `src/app/api/v1/inventory/route.ts`
- FIFO setting and layer usage:
  - `src/modules/inventory/application/documents.service.ts` + `InventoryCostLayer`.

## What was missing before this pass (now addressed)
- No Rust stock-settings endpoints.
- No canonical `/api/stock/settings` route.
- No full ERP-style stock settings tabbed UI.
- No optimistic concurrency contract for settings writes.
- No FIFO cost-layer table for valuation tracking.
- No stock-closing freeze enforcement.

## Remaining gaps (post-pass follow-up)
- Rust unit/integration tests for stock settings handlers are still thin (no dedicated endpoint test module yet).
- Dedicated Playwright spec for Stock Settings role matrix/concurrency is not yet added in this pass.
