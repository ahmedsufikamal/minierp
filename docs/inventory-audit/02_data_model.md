# Inventory Data Model (AS-IS)

## Core master data
- `Product` (item master)
  - tenant/company scoped by `companyId`
  - key uniqueness: `@@unique([companyId, brandId, normalizedSku])`
- `Brand`, `Category`, `SubCategory`
- Setup references used by inventory forms:
  - `SetupItemGroup`, `SetupUom`, `SetupUomConversionFactor`

## Warehousing
- `InventoryWarehouse`
  - `@@unique([companyId, code])`
- `InventoryWarehouseLocation`
  - supports parent-child tree via `parentId`
  - `@@unique([companyId, warehouseId, code])`

## Documents and posting
- `InventoryDocument`
  - types: `ADJUSTMENT | TRANSFER | RECEIPT | ISSUE | COUNT`
  - status: `DRAFT | SUBMITTED | APPROVED | REJECTED | CANCELLED | POSTED`
  - `@@unique([companyId, number])`
- `InventoryDocumentLine`
  - item + qty + optional source/destination warehouse/location + reservation/batch/serial payload.
- `InventoryWorkflowState`
  - tracks current workflow status and step history.

## Ledger and balances
- `InventoryLedgerEntry`
  - immutable posting rows per movement
  - key fields: `postingTime`, `itemId`, `warehouseId`, `quantityDelta`, `documentId`
- `InventoryStockBalance`
  - current state projection (onHand/reserved/incoming/outgoing/avgCost)
  - `@@unique([companyId, itemId, warehouseId, locationId])`

## Tracking and planning
- `InventoryBatch`
- `InventorySerial`
- `InventoryReservation`
- `InventoryReorderRule`

## Configuration/extensibility
- `InventoryCompanySetting`
  - currently includes `trackByLocation`, `preventNegativeStock`, `allowNegativeOverride`, `costingMethod`, `baseCurrency`.
- `InventoryCustomFieldDefinition`
- `InventoryCustomFieldValue`
- `InventoryViewPreset`
- `InventoryWorkflowDefinition`
- `InventoryLabelTemplate`

## Operational support models
- `InventoryAttachment`
- `InventoryImportJob`, `InventoryImportJobRowError`
- `InventoryExportJob`
- `InventoryIdempotencyKey`
- `InventoryAuditLog`
- `InventoryNotification`
- `InventoryWebhookSubscription`

## Legacy overlap (important risk)
Inventory module coexists with older stock entities still present in schema:
- `InventoryMove`, `StockBalance`, `StockLedger`, `InventorySnapshot`.

This means inventory behavior currently spans both “new inventory tables” and legacy stock-era structures in some UI areas, and requires careful scoping during refactors/migration.
