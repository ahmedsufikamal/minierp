# Inventory Audit Failures and Status

## F-01: Fresh install could fail before Prisma client generation
- Status: `fixed`
- Reproduction steps:
  1. Run `npm ci`.
  2. Start dev server and call inventory API routes.
  3. Previously observed `@prisma/client did not initialize yet`.
- Root cause:
  - Prisma generation was not guaranteed during install.
- Code change applied:
  - Added install lifecycle generation in `package.json`:
    - `"postinstall": "npm run prisma:generate"`.
- Verification checks:
  - `npm ci` now runs Prisma generation successfully.
  - Evidence: `docs/inventory-audit/logs/33_npm_ci_postinstall.log`.

## F-02: Seed fails in current DB state (`P2002` on membership uniqueness)
- Status: `open`
- Reproduction steps:
  1. Run `npm run prisma:seed`.
  2. Observe `P2002` conflict on `CompanyMembership.companyId`.
- Root cause:
  - Seed path is not fully idempotent for existing data/constraints in this DB.
- Code change planned:
  - Make membership seeding deterministic/idempotent for reruns.
- Verification checks:
  - `npm run prisma:seed` should complete without Prisma constraint errors.
  - Current evidence: `docs/inventory-audit/logs/17_prisma_seed.log`.

## F-03: Migration drift (unapplied migrations)
- Status: `open`
- Reproduction steps:
  1. Run `npx prisma migrate status`.
  2. Observe unapplied migrations.
- Root cause:
  - Local DB schema is behind migration directory head.
- Code change planned:
  - Apply pending migrations in target DB before release verification.
- Verification checks:
  - `npx prisma migrate status` should report up-to-date.
  - Current evidence: `docs/inventory-audit/logs/15_prisma_migrate_status.log`.

## F-04: Inventory namespace split (`/inventory/*` redirects to `/stock/*`)
- Status: `open`
- Reproduction steps:
  1. Request `/inventory` or `/inventory/items`.
  2. Observe `307` to `/stock/overview` and `/stock/items`.
- Root cause:
  - Redirect compatibility layer in `next.config.ts`.
- Code change planned:
  - Keep as compatibility layer for now; consolidate namespaces in later routing cleanup.
- Verification checks:
  - Redirect behavior is intentional and documented.
  - Evidence: `docs/inventory-audit/logs/21_dev_inventory_overview.log`, `docs/inventory-audit/logs/22_dev_inventory_items.log`.

## F-05: Tenant hardening gaps in inventory mutation paths
- Status: `fixed`
- Reproduction steps:
  1. Review mutation calls that previously updated/deleted by bare `id` after scoped pre-read.
  2. Risk: accidental cross-company mutation if guard patterns drift.
- Root cause:
  - Some inventory services relied on pre-check discipline instead of scoped write predicates.
- Code change applied:
  - Hardened writes to company-scoped semantics (`updateMany/deleteMany` + scoped re-read) in:
    - `src/modules/inventory/application/items.service.ts`
    - `src/modules/inventory/application/warehouses.service.ts`
    - `src/modules/inventory/application/reorder.service.ts`
    - `src/modules/inventory/application/custom-fields.service.ts`
    - `src/modules/inventory/application/attachments.service.ts`
    - `src/modules/inventory/application/view-presets.service.ts`
    - `src/modules/inventory/application/label-templates.service.ts`
  - Added cross-company negative tests:
    - `src/modules/inventory/application/__tests__/tenant-isolation.integration.test.ts`.
- Verification checks:
  - `RUN_INTEGRATION_TESTS=1 npx vitest run ...tenant-isolation... ...document-posting... ...wave2...`
  - Evidence: `docs/inventory-audit/logs/39_inventory_integration_after_fix.log`.

## F-06: Inventory smoke critical flow coverage missing
- Status: `fixed`
- Reproduction steps:
  1. Run smoke e2e for inventory critical flows.
  2. Previously no dedicated inventory smoke suite.
- Root cause:
  - Inventory lacked an end-to-end smoke pack covering documents and ledger state transitions.
- Code change applied:
  - Added `tests/e2e/smoke/inventory-flows.spec.ts`:
    1. Create Item
    2. Create Warehouse
    3. Receive stock
    4. Transfer stock
    5. Adjustment
    6. Ledger/balance assertions
- Verification checks:
  - `npm run test:e2e:smoke`
  - Evidence: `docs/inventory-audit/logs/38_test_e2e_smoke.log`.

## F-07: Rust inventory slice quality gate failures
- Status: `fixed`
- Reproduction steps:
  1. Run `cargo test --workspace` / `cargo clippy --workspace --all-targets -- -D warnings`.
  2. Previously failed due SQLx derive feature mismatch and Swagger dependency/network build issues.
- Root cause:
  - Rust dependency/compile configuration was inconsistent with introduced inventory handlers.
- Code change applied:
  - Enabled SQLx derive feature.
  - Removed unused Swagger UI dependency that required network asset download.
  - Fixed compile issues in `apps/api-rust/src/main.rs` (query params derive, pool timeout API, routing imports).
- Verification checks:
  - `cargo test --workspace`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - Evidence: `docs/inventory-audit/logs/36_cargo_test.log`, `docs/inventory-audit/logs/37_cargo_clippy.log`.

## F-08: Static tenancy audit still reports advisories
- Status: `open`
- Reproduction steps:
  1. Run `npm run tenancy:audit`.
  2. Observe advisory findings across modules (including inventory list/count calls).
- Root cause:
  - Scanner is conservative and flags potential unscoped usage patterns broadly.
- Code change planned:
  - Continue narrowing findings in inventory and optionally move to stricter scoped repository helpers over time.
- Verification checks:
  - `npm run tenancy:audit`
  - Current evidence: `docs/inventory-audit/logs/34_tenancy_audit_after_fix.log`.

## Global verification snapshot
- Full local quality gate after fixes:
  - `bash scripts/check.sh`
  - Evidence: `docs/inventory-audit/logs/40_check_after_fix.log`.
