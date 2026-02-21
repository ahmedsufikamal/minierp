# Stock Settings Fix Log

Format per item:
1. Reproduction
2. Root cause
3. Code change
4. Verification
5. Status

## F-01 Rust settings API returned 500 (version decode mismatch)
1. Reproduction:
   - Call `GET /api/stock/settings` on Rust service.
   - Observe `500` and decode error in rust log.
2. Root cause:
   - SQLx row expected `version` as `i64`, DB column is `INT4`.
3. Code change:
   - Updated Rust stock-settings `SELECT/RETURNING` projections to cast `version` as `bigint`.
   - Kept write compare explicit with integer cast in `WHERE "version" = $2::integer`.
   - File: `apps/api-rust/src/main.rs`.
4. Verification:
   - `docs/stock-settings/logs/41_rust_stock_settings_get.log` shows `HTTP/1.1 200 OK`.
   - `docs/stock-settings/logs/42_rust_stock_settings_patch.log` shows `200` update and `409` stale-version conflict.
5. Status: `fixed`

## F-02 Rust SQL alias truncation risk for long field name
1. Reproduction:
   - Rust mapping for `allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice` could fail due long alias truncation in PostgreSQL.
2. Root cause:
   - Extremely long SQL alias can be truncated, breaking `FromRow` field mapping.
3. Code change:
   - Introduced shorter alias `allow_material_transfer_pr_to_pi` and mapped to response field.
   - File: `apps/api-rust/src/main.rs`.
4. Verification:
   - `GET /api/stock/settings` returns full payload with `allow_material_transfer_from_purchase_receipt_to_purchase_invoice` value.
5. Status: `fixed`

## F-03 Migration deploy failed due non-null timestamp in backfill insert
1. Reproduction:
   - `npx prisma migrate deploy` failed during stock-settings migration.
2. Root cause:
   - Backfill insert path did not set required `updatedAt` (and explicit `createdAt` consistency).
3. Code change:
   - Updated migration insert SQL to provide both timestamp columns in inserted rows.
   - Files:
     - `prisma/migrations/20260221130000_stock_settings_erp_rust/migration.sql`
4. Verification:
   - `docs/stock-settings/logs/15_prisma_migrate_status.log` now reports schema up to date.
5. Status: `fixed`

## F-04 Legacy route drift (`/api/v1/inventory/settings`) vs canonical route
1. Reproduction:
   - Settings callers split across legacy inventory route and planned stock route.
2. Root cause:
   - Route contract not centralized to Rust-backed canonical endpoint.
3. Code change:
   - Added canonical Next route: `src/app/api/stock/settings/route.ts`.
   - Added Rust proxy: `src/modules/inventory/interface/rust-stock-settings-proxy.ts`.
   - Removed old route: `src/app/api/v1/inventory/settings/route.ts`.
   - Updated UI to call `/api/stock/settings`.
4. Verification:
   - `docs/stock-settings/logs/41_rust_stock_settings_get.log` and `docs/stock-settings/logs/42_rust_stock_settings_patch.log`.
5. Status: `fixed`

## F-05 Inventory settings UI not ERP-style and lacked robust save UX
1. Reproduction:
   - Settings page previously mixed customization tabs and lacked ERP stock-settings grouping.
2. Root cause:
   - Existing UI was not aligned with stock-settings domain model.
3. Code change:
   - Replaced client UI with six ERP-style tabs and mapped all settings fields.
   - Added read-only mode, optimistic save behavior, and dirty navigation guard.
   - Files:
     - `src/app/(app)/inventory/settings/page.tsx`
     - `src/app/(app)/inventory/settings/settings-client.tsx`
4. Verification:
   - `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` logs under `docs/stock-settings/logs`.
5. Status: `fixed`

## F-06 Missing enforcement for stock closing and reservation toggle semantics
1. Reproduction:
   - Backdated posting paths and availability calculations did not consistently apply new settings semantics.
2. Root cause:
   - Partial use of legacy setting fields and ad hoc reads.
3. Code change:
   - Added centralized stock settings loader/cache:
     - `src/modules/inventory/application/stock-settings.service.ts`
   - Added freeze-window checks and `allow_negative_stock` enforcement in document posting paths:
     - `src/modules/inventory/application/documents.service.ts`
     - `src/modules/inventory/domain/posting.ts`
   - Added reservation-toggle aware availability:
     - `src/modules/inventory/application/reorder.service.ts`
     - `src/app/api/v1/inventory/route.ts`
4. Verification:
   - Unit and integration coverage updated:
     - `src/modules/inventory/domain/__tests__/posting.test.ts`
     - `src/modules/inventory/application/__tests__/posting-flow.e2e.test.ts`
5. Status: `fixed`

## F-07 Production startup requires inventory signing secret
1. Reproduction:
   - `npm run start` without `INVENTORY_STORAGE_SIGNING_SECRET` causes startup failure.
2. Root cause:
   - Production safeguard enforces required secret length.
3. Code change:
   - Not changed in this pass (intentional safeguard).
4. Verification:
   - `docs/stock-settings/logs/30_prod.log` captures failure condition.
5. Status: `open (expected env prerequisite)`

## F-08 Automated endpoint test depth for stock settings
1. Reproduction:
   - Rust handler had runtime verification logs but no stock-settings DB-backed or dedicated smoke verification.
2. Root cause:
   - Rust service test scaffolding existed but stock-settings logic lacked targeted coverage beyond manual probes.
3. Code change:
   - Added Rust unit tests for:
     - settings payload validation rules
     - `If-Match` parsing
     - write-permission alias handling
     - DB-backed create/update/stale-version flow (`stock_settings_db_flow_respects_version_updates`)
   - File: `apps/api-rust/src/main.rs`
   - Added dedicated Playwright stock-settings smoke suite:
     - writer save + stale-version conflict
     - member read-only mode
     - File: `tests/e2e/smoke/stock-settings.spec.ts`
4. Verification:
   - `docs/stock-settings/logs/20_cargo_test.log` shows new stock-settings tests passing.
   - `docs/stock-settings/logs/43_stock_settings_e2e.log` shows stock-settings smoke scenarios passing.
5. Status: `fixed`
