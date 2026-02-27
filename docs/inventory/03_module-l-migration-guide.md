# Module L Migration Guide

This guide covers production rollout for Module L (immutable inventory ledger, costing, ops tooling, and `/stock` admin).

## 1) Pre-deploy checks

- Confirm backups/PITR are enabled for Postgres.
- Confirm Redis is available if `INVENTORY_QUEUE_PROVIDER=bullmq`.
- Confirm service account/user roles include:
  - `inventory.document.post`
  - `inventory.document.approve`
  - `inventory.overrideNegativeStock`
  - `inventory.ledger.read`
  - `inventory.settings.write`
  - `inventory.admin.ops`

## 2) Deploy application code

- Deploy app/API code first (schema-compatible release).
- Keep workers disabled until DB migration is complete.

## 3) Run database migration

Run Prisma migration deploy on production:

```bash
npx prisma migrate deploy
```

Expected new/updated inventory artifacts include:

- `InventoryLedgerEntry.postingSeq`, transfer/reversal metadata
- `InventoryCostLayerAllocation`
- serial receipt-cost fields
- batch/serial layer dimensions
- `InventoryOutboxEvent`
- `InventoryStockClosing`, `InventoryStockClosingLine`
- `InventoryOpsJob`

## 4) Regenerate + restart app processes

```bash
npm run prisma:generate
```

- Restart web/API processes after migration.

## 5) Enable inventory workers

Start the inventory worker:

```bash
npm run inventory:worker
```

If running BullMQ:

- set `INVENTORY_QUEUE_PROVIDER=bullmq`
- set `REDIS_URL`
- set `INVENTORY_WORKER_TOKEN`
- ensure worker can call `POST /api/v1/inventory/admin/jobs/process`

## 6) Initial rebuild and closing

1. Run a full-scope repost/rebuild from `/stock/admin/repost` (or `POST /api/v1/inventory/admin/repost`).
2. Verify variance report from `/stock/admin/variance` is clean.
3. Create initial stock closing from `/stock/admin/closing` for the active reporting period.

## 7) Post-deploy validation

- Post a test stock document with `Idempotency-Key`, retry same request, confirm no duplicate ledger rows.
- Confirm outbox relay is processing (`inventory:outbox-relay`).
- Confirm admin jobs list updates status for repost/stock-closing.
- Confirm rate limits and RBAC are enforced on sensitive endpoints.

## 8) Ongoing monitoring

Track:

- Variance mismatches (`onHand` vs ledger, FIFO layers vs onHand)
- Serialization retry rate / conflict frequency
- Outbox lag, attempts, dead-letter count
- Repost/closing job failure count and duration

## 9) Rollback note

- Do not delete ledger rows during rollback.
- If rollback is required, revert code and keep ledger immutable; repair derived tables using repost/rebuild after restoring service.
