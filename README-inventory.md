# Inventory Module (Multi-Tenant, Configurable)

This repository now contains a production-oriented Inventory module with:

- Multi-company isolation (`companyId` / `orgId` scoping)
- RBAC-based policy checks for inventory permissions
- Configurable custom fields and dynamic item columns
- Configurable document workflows
- Immutable ledger posting + derived stock balances
- Multi-warehouse / nested locations
- Stock reconciliation preview/apply pipeline (COUNT-backed)
- Reservation lifecycle with balance-aware locking
- Serial/batch baseline registry and posting hooks
- Reorder rules + suggestions
- Import/export jobs with validation preview
- Barcode/QR scan entry support (keyboard scanner + browser image scan)
- Attachment metadata + presigned upload/download URL flow
- Inventory-specific audit logs with request metadata

## Architecture

Inventory code follows a DDD-lite structure:

- `src/modules/inventory/domain`
  - Core invariants and pure rules (`posting.ts`, `reorder.ts`, `workflow.ts`, custom field validation)
- `src/modules/inventory/application`
  - Use-case services (items, documents, workflow, custom fields, reorder, presets, attachments, imports/exports)
  - Shared Zod schemas
  - RBAC policy mapping
- `src/modules/inventory/infrastructure`
  - Prisma-backed audit adapter
  - Storage URL strategy
  - Queue capability detection (BullMQ optional)
- `src/modules/inventory/interface`
  - Request context (tenant + user + role + requestId)
  - HTTP adapters and typed error responses

API surface lives under: `src/app/api/v1/inventory/*`

Primary UI routes now live under: `src/app/(app)/stock/*`
Legacy `/inventory/*` routes are retained for compatibility and redirect users to `/stock/*`.

## Module L Governance Rules

1. Ledger immutability
- `InventoryLedgerEntry` rows are append-only.
- Corrections use compensating/reversal entries (`reversalOfLedgerEntryId`), never delete/update in place.

2. Idempotent posting/reconciliation/ops
- `Idempotency-Key` is required for:
  - document posting (`POST` action),
  - reconciliation apply,
  - admin repost,
  - admin stock closing.
- Reusing a key with a different request hash returns a conflict.

3. Valuation policy
- Company valuation method supports `FIFO`, `MOVING_AVERAGE`, and `STANDARD`.
- `STANDARD` uses item baseline cost (`Product.unitCostMinor`) for postings where applicable.
- FIFO outbound consumes oldest layers first and records detailed layer allocations.

4. FIFO transfer layer preservation
- Transfer-out records source-layer allocations (`InventoryCostLayerAllocation` + `transferGroupId`).
- Transfer-in recreates destination layers per allocation (same unit cost/qty), no transfer averaging.

5. Serial and lot costing
- Serial-tracked outbound uses specific identification:
  - receipt cost is stored on serial (`receiptUnitCostMinor`, `receiptCurrency`, `receiptLedgerEntryId`);
  - outbound serials must have receipt cost.
- Batch-tracked outbound is lot-scoped:
  - layer consumption is restricted to the selected batch.

6. Operational controls
- Variance report compares:
  - `InventoryStockBalance.onHand` vs ledger quantity sum,
  - FIFO layer quantity sum vs on-hand (when FIFO enabled).
- Repost/rebuild recomputes derived balances/layers from immutable ledger.
- Stock closing materializes period quantity/value snapshot for faster reporting.

## Local Dev Setup

1. Start dependencies:

```bash
docker compose -f docker-compose.dev.yml up -d
```

2. Set environment variables (example):

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/minierp
JWT_SECRET=replace-with-32-plus-char-secret
API_KEY=local-dev-api-key
API_ORG_ID=default-org
REDIS_URL=redis://127.0.0.1:6379
INVENTORY_STORAGE_PUBLIC_BASE_URL=http://127.0.0.1:9000/minierp
INVENTORY_STORAGE_SIGNING_SECRET=replace-with-random-secret
```

3. Run migrations and generate Prisma client:

```bash
npm run prisma:migrate:dev
npm run prisma:generate
```

4. Seed inventory demo data:

```bash
npm run prisma:seed
```

5. Start app:

```bash
npm run dev
```

## New DB/Migration Artifacts

- Prisma schema extended in `prisma/schema.prisma`
- Migration added:
  - `prisma/migrations/20260211100000_inventory_platform_extension/migration.sql`
  - `prisma/migrations/20260222000000_phase2_wave2_stock_mvp/migration.sql`

Key new entities include:

- `Company`, `CompanyMembership`
- `InventoryWarehouse`, `InventoryWarehouseLocation`
- `InventoryDocument`, `InventoryDocumentLine`, `InventoryWorkflowDefinition`, `InventoryWorkflowState`
- `InventoryLedgerEntry`, `InventoryStockBalance`
- `InventoryCustomFieldDefinition`, `InventoryCustomFieldValue`
- `InventoryViewPreset`
- `InventoryReorderRule`
- `InventoryReservation`
- `InventoryBatch`, `InventorySerial`
- `InventoryAttachment`
- `InventoryImportJob`, `InventoryImportJobRowError`, `InventoryExportJob`
- `InventoryIdempotencyKey`
- `InventoryAuditLog`, `InventoryNotification`
- `InventoryLabelTemplate`

## Routes

Main UI routes:

- `/stock`
- `/stock/items`
- `/stock/items/new`
- `/stock/items/[id]`
- `/stock/warehouses`
- `/stock/warehouses/[warehouseId]`
- `/stock/documents`
- `/stock/documents/new`
- `/stock/documents/[docId]`
- `/stock/ledger`
- `/stock/reorder`
- `/stock/settings`
- `/stock/admin/variance`
- `/stock/admin/repost`
- `/stock/admin/closing`

API routes (REST):

- `/api/v1/inventory/items` (+ `/[itemId]`, `/search`, `/bulk-custom-fields`)
- `/api/v1/inventory/warehouses` (+ `/[warehouseId]`)
- `/api/v1/inventory/locations` (+ `/[locationId]`)
- `/api/v1/inventory/documents` (+ `/[docId]`, `/[docId]/actions`)
- `/api/v1/inventory/ledger`
- `/api/v1/inventory/balances`
- `/api/v1/inventory/reorder-rules` (+ `/[ruleId]`)
- `/api/v1/inventory/reorder-suggestions`
- `/api/v1/inventory/reconciliation` (+ `/preview`)
- `/api/v1/inventory/reservations` (+ `/[reservationId]/release`)
- `/api/v1/inventory/admin/variance-report`
- `/api/v1/inventory/admin/repost`
- `/api/v1/inventory/admin/stock-closing`
- `/api/v1/inventory/admin/jobs`
- `/api/v1/inventory/custom-fields` (+ `/[fieldId]`, `/schema`)
- `/api/v1/inventory/view-presets` (+ `/[presetId]`)
- `/api/v1/inventory/attachments` (+ upload/finalize/download routes)
- `/api/v1/inventory/import-jobs` (+ preview/commit)
- `/api/v1/inventory/export-jobs`
- `/api/v1/inventory/workflows`
- `/api/v1/inventory/label-templates`

## Import Templates

CSV templates:

- `docs/inventory/templates/items-template.csv`
- `docs/inventory/templates/opening-balances-template.csv`
- `docs/inventory/templates/reorder-rules-template.csv`

Current import flow supports preview + commit semantics to avoid partial apply when validation errors exist.

## Custom Fields (No-Code)

1. Open `/inventory/settings`
2. In **Custom Fields** tab:
   - select entity type
   - define key, label, field type
   - optional options (`a,b,c`) for select-like fields
   - toggle required/show-in-list
3. Field appears in:
   - `/inventory/items/new` dynamic form
   - `/inventory/items` column manager and saved views

## Workflows (No-Code JSON Builder)

1. Open `/inventory/settings`
2. In **Workflows** tab, save workflow JSON for each document type
3. Document action API enforces allowed transitions and required permissions
4. Posting (`POST`) is idempotent via `InventoryIdempotencyKey`

## Label Templates

1. Open `/inventory/settings`
2. In **Label Templates** tab, store template JSON for A4/Thermal
3. Current implementation stores and manages template configuration and supports browser print workflows

## Tests

Run:

```bash
npm run test
npm run test:e2e
npm run lint
npm run typecheck
```

Inventory-focused tests added for:

- Posting invariants
- Workflow transitions + permission mapping
- Custom field validation
- Reorder suggestion logic
- Integration-style posting flow test (DB-dependent)

## Operational Notes / Tradeoffs

- BullMQ integration is optional and detected at runtime. If `bullmq` package or `REDIS_URL` is missing, import/export runs inline.
- Inventory ops queues/jobs:
  - `inventory:repost`
  - `inventory:stock-closing`
  - `inventory:outbox-relay`
- Outbox relay uses dedicated `InventoryOutboxEvent` with retry/dead-letter states.
- Sensitive endpoints (`post`, `reconcile`, `repost`, `stock-closing`) are rate-limited.
- Presigned storage URLs are implemented with a provider-agnostic signed URL strategy. For full S3 signing, plug in AWS SDK/MinIO signer in `storage.ts`.
- Camera scan uses browser `BarcodeDetector` when available, with keyboard scanner fallback always available.
- Label printing currently emphasizes configurable templates and print-ready browser output. Dedicated PDF rendering can be added behind the same template model.

## Production Checklist

1. Backups
- Enable automated Postgres backups + point-in-time recovery.

2. Storage
- Configure S3/MinIO bucket lifecycle and encryption.
- Rotate storage signing secrets.

3. DB and Pooling
- Use connection pooling / PgBouncer.
- Monitor lock contention for posting transactions.

4. Queue/Workers
- Enable Redis and BullMQ workers for large import/export jobs.
- Add dead-letter and retry policies.

5. Security
- Enforce HTTPS-only cookies and strict secret management.
- Add rate limiting for import and scan-related endpoints.
- Validate/sanitize user text input to prevent stored XSS.

6. Audit and Retention
- Define retention policy for `InventoryAuditLog`.
- Ensure audit streams are exported to centralized logging.

7. Observability
- Propagate and log request IDs.
- Add OpenTelemetry traces around posting/import/export.
