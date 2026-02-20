# Inventory Current Architecture (AS-IS)

## Stack context
- Frontend/runtime: Next.js 16 App Router (`src/app`), React 19, TypeScript, Tailwind.
- Inventory backend today: Next route handlers under `src/app/api/v1/inventory/*` calling TypeScript services in `src/modules/inventory/application/*`.
- Data layer: Prisma + Postgres (`prisma/schema.prisma`) with inventory-specific models and legacy stock models co-existing.
- Auth/permission path for inventory APIs:
  1. `withInventoryAuth(...)` in `src/modules/inventory/interface/http.ts`
  2. `getInventoryRequestContext(...)` in `src/modules/inventory/interface/context.ts`
  3. IAM/session resolution + company switch via `x-company-id` membership check
  4. Role/permission enforcement (`inventoryPermissions` + IAM compatibility map)

## Frontend route map (inventory scope)
Canonical pages are under `src/app/(app)/inventory/*` and stock aliases under `src/app/(app)/stock/*`:
- Overview: `src/app/(app)/inventory/page.tsx` (redirected from `/inventory` to `/stock/overview` by Next redirects)
- Items: `src/app/(app)/inventory/items/*`
- Warehouses: `src/app/(app)/inventory/warehouses/*`
- Documents: `src/app/(app)/inventory/documents/*`
- Ledger: `src/app/(app)/inventory/ledger/page.tsx`
- Reorder: `src/app/(app)/inventory/reorder/*`
- Settings: `src/app/(app)/inventory/settings/*`

Routing note:
- `next.config.ts` currently redirects `/inventory*` to `/stock/*` paths.
- `src/app/(app)/stock/*` files re-export the inventory pages.

## Inventory API map (current)
Route handlers found under `src/app/api/v1/inventory/*`:
- Core: `route.ts`, `items/*`, `warehouses/*`, `documents/*`, `ledger/*`, `balances/*`
- Reorder: `reorder-rules/*`, `reorder-suggestions/*`
- Reconciliation: `reconciliation/*`
- Settings/config-like: `custom-fields/*`, `view-presets/*`, `workflows/*`, `label-templates/*`
- Attachments/import-export: `attachments/*`, `import-jobs/*`, `export-jobs/*`
- Reservations/locations: `reservations/*`, `locations/*`

## Service/module boundaries
Inventory module internals under `src/modules/inventory`:
- Application services:
  - `items.service.ts`
  - `warehouses.service.ts`
  - `documents.service.ts`
  - `reorder.service.ts`
  - `reconciliation.service.ts`
  - `reservations.service.ts`
  - `custom-fields.service.ts`
  - `attachments.service.ts`
  - `import-export.service.ts`
  - `workflow.service.ts`
  - `label-templates.service.ts`
  - `view-presets.service.ts`
- Interface:
  - `interface/context.ts` (auth + tenant/company context)
  - `interface/http.ts` (request parsing, error envelope, permission wrapper)
- Domain:
  - posting/reorder/custom-field/workflow rules + typed inventory errors.
- Infra:
  - audit logging, queue/storage helpers.

## Rust strangler baseline (already present)
- Existing Rust workspace members: `apps/api-rust`, `crates/domain`.
- Current Rust API exposes:
  - `GET /api/health`
  - `GET /api/v1/ping`
  - `GET /api/v1/inventory/items`
  - `POST /api/v1/inventory/items`
  - `GET /api/v1/inventory/items/:item_id`
- Existing Next proxy adapter for Rust passthrough:
  - `src/app/api/rust/[...path]/route.ts`
  - activated by `RUST_API_BASE_URL`.
- Inventory slice proxy:
  - `src/app/api/v1/inventory/items/route.ts`
  - `src/app/api/v1/inventory/items/[itemId]/route.ts`
  - feature flag: `INVENTORY_ITEMS_RUST_ENABLED=1`
  - security header shared secret: `RUST_TRUSTED_PROXY_SECRET`

## Runtime probe summary
See logs in `docs/inventory-audit/logs/`:
- Dev probes (`20_*` to `25_*`) now start successfully and inventory APIs correctly require auth (401 when unauthenticated).
- Prod probe (`30_*` to `32_*`) starts successfully and `/api/health` returns dependency-aware payload.
- `/inventory` and `/inventory/items` return 307 redirects to `/stock/overview` and `/stock/items` by config.
