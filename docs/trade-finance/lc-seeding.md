# Trade Finance LC Seeding

`ensureTradeLcDefaults(ctx)` lazily provisions the baseline LC setup for the active tenant/company.

## Numbering

- Number series key: `TRADE_LC`
- Name: `Letter of Credit`
- Pattern: `LC-{FY}-{####}`
- Reset policy: `FISCAL_YEAR`

## Default Document Types

- `COMM_INV` → Commercial Invoice
- `PACK_LIST` → Packing List
- `BL_AWB` → Bill of Lading / AWB
- `COO` → Certificate of Origin
- `INSURANCE` → Insurance
- `INSPECTION` → Inspection Certificate

## Default Charge Types

- `COMMISSION`
- `SWIFT`
- `COURIER`
- `STAMP`
- `VAT`
- `DISCREPANCY_FEE`
- `OTHER`

## Default Incoterms

- `FOB`
- `CIF`
- `CFR`
- `EXW`
- `DAP`
- `DDP`

## Default Settings

- `dualControlEnabled = true`
- `expiringSoonDays = 30`
- `maturitySoonDays = 15`
