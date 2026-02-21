# Stock Settings TO-BE

## Canonical API contract
- Base path: `/api/stock/settings`
- Methods:
  - `GET` read current company settings.
  - `PATCH` partial update.
  - `PUT` full replace.
- Envelope:
  - success: `{ ok: true, data }`
  - error: `{ ok: false, error: { code, message, details? } }`
- Payload casing: `snake_case`.
- Concurrency:
  - writes require `If-Match` or body `version`.
  - stale writes return `409 CONFLICT` with latest snapshot.

## Access policy
- Read: any authenticated tenant member.
- Write: requires `inventory.settings.write`.
- Tenancy: all reads/writes company-scoped; cross-company access forbidden.

## Field set and defaults by tab

## 1) Defaults
- `item_naming_by`: `ITEM_CODE` | `NAMING_SERIES` (default `ITEM_CODE`)
- `default_warehouse_id`: nullable
- `default_stock_uom_id`: nullable
- `default_valuation_method`: `FIFO` | `MOVING_AVERAGE` (default `FIFO`)
- `auto_insert_item_price_if_missing`: `true`
- `update_existing_price_list_rate`: `false`
- `allow_edit_stock_uom_qty_sales_docs`: `true`
- `allow_edit_stock_uom_qty_purchase_docs`: `true`

## 2) Stock Validations
- `over_delivery_receipt_allowance_pct`: `0..100`, default `0`
- `over_transfer_allowance_pct`: `0..100`, default `0`
- `over_picking_allowance_pct`: `0..100`, default `0`
- `allow_negative_stock`: `false`
- `show_barcode_field_in_stock_transactions`: `true`
- `convert_item_description_to_clean_html`: `true`
- `allow_internal_transfers_at_arms_length_price`: `false`
- `qi_action_if_not_submitted`: `STOP | WARN | ALLOW` (default `STOP`)
- `qi_action_if_rejected`: `STOP | WARN | ALLOW` (default `STOP`)

## 3) Stock Reservation
- `enable_stock_reservation`: `true`
- `allow_partial_reservation`: `false`
- `auto_reserve_stock_for_sales_order_on_purchase`: `false`
- `auto_reserve_serial_and_batch_nos`: `false`

## 4) Serial & Batch Item
- `auto_create_serial_and_batch_bundle_for_outward`: `true`
- `pick_serial_batch_based_on`: `FIFO | LIFO | EXPIRY` (default `FIFO`)
- `disable_serial_no_and_batch_selector`: `false`
- `have_default_naming_series_for_batch_id`: `false`
- `use_serial_batch_fields`: `false`
- `do_not_update_serial_batch_on_creation_of_auto_bundle`: `false`
- `allow_existing_serial_no_to_be_received_again`: `true`
- `set_bundle_naming_based_on_naming_series`: `false`

## 5) Stock Planning
- `raise_material_request_when_stock_reaches_reorder_level`: `true`
- `notify_by_email_on_creation_of_automatic_material_request`: `false`
- `allow_material_transfer_from_delivery_note_to_sales_invoice`: `false`
- `allow_material_transfer_from_purchase_receipt_to_purchase_invoice`: `false`

## 6) Stock Closing
- `freeze_stocks_older_than_days`: integer `>= 0`, default `60`

## Enforcement matrix (high-impact first)
- `allow_negative_stock`
  - Enforced at posting/submission paths; blocks outbound if insufficient and no override.
- `freeze_stocks_older_than_days`
  - Enforced on backdated create/update/submit/post against current time cutoff.
- `default_valuation_method`
  - Controls inbound/outbound valuation path; FIFO uses `InventoryCostLayer`.
- `enable_stock_reservation`
  - Availability calculations include/exclude reserved qty based on toggle.

## Compatibility
- Legacy fields in `InventoryCompanySetting` remain synchronized for non-migrated flows:
  - `costingMethod` mirrors valuation.
  - `preventNegativeStock` mirrors `!allow_negative_stock`.
