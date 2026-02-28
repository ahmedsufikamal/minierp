# Execution Plan: Module B + Module C

## 1) Architecture Decision
- Source of truth: Next.js App Router route handlers + TypeScript application services + Prisma schema/migrations.
- Rust boundary: unchanged for this pass; no new Module B/C APIs are implemented in Rust.
- API boundary: `/api/v1/meta/*` and `/api/v1/master/*` are served by Next.js with existing platform auth context.

## 2) Migration Plan
- Add Module B metadata tables: `MetaModel`, `MetaFieldDef`, `MetaWorkflowDef`, `MetaWorkflowState`, `MetaWorkflowTransition`, `MetaPrintTemplate`, `MetaPermissionPolicy`, `MetaCustomPermissionType`, `MetaChangeLog`, `CompiledMeta`.
- Add Module C master tables: `MasterParty`, `MasterAddress`, `MasterContact`, `MasterPartyMergeHistory`, `MasterPriceList`, `MasterPriceListItem`, `MasterCurrency`, `MasterTaxCode`.
- Extend existing entities:
- `Product`: `barcode`, `itemType`, `itemStatus`, `customData`.
- `NumberSeries`: `lastResetYear`.
- Reuse existing `SetupUom`, `SetupUomConversionFactor`, `InventoryWarehouse`, `InventoryWarehouseLocation`, `AccountingExchangeRate`.
- Add indexes: compiled metadata keys, JSONB GIN for custom data, uniqueness constraints, and conditional trigram indexes when `pg_trgm` exists.

## 3) Endpoint Plan
- Metadata API: models, compiled schema, custom fields, workflows draft/publish, print templates draft/publish/render, export/import, audit.
- Master API: items CRUD/search, parties CRUD/search/merge, UoM list, price list list/upsert, currency list, tax code list, number series next.

## 4) UI Pages Plan
- Add Platform navigation entries:
- Metadata Studio
- Master Parties / Items / UOM / Price Lists / Currencies / Tax Codes / Number Series
- Add metadata model detail page with tabs and publish action.
- Add reusable `DynamicForm` component driven by compiled metadata UI fields.

## 5) Testing Plan
- Unit tests:
- Metadata compile correctness + validation.
- Metadata security operator/template constraints.
- Workflow transition enforcement.
- Number-series transactional uniqueness.
- API permission parity tests for new meta/master routes.
- UI smoke:
- Sidebar collapse/expand discoverability.
- Platform metadata/master page load smoke.
