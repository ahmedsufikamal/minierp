# Module C: Master Data Management (MDM)

## Entities
- Parties: `MasterParty`, child `MasterAddress`, `MasterContact`.
- Party merge history: `MasterPartyMergeHistory`.
- Items: existing `Product` extended with barcode/type/status/custom data.
- Price lists: `MasterPriceList`, `MasterPriceListItem`.
- Currencies: `MasterCurrency`.
- Tax codes: `MasterTaxCode`.
- Numbering: existing `NumberSeries` + `NumberSeriesCounter` with `lastResetYear`.

## Key Behaviors
- Strict tenant/company scoping in every query and mutation.
- Search endpoints support code/name/barcode patterns for high-read scenarios.
- Party dedup metadata stores normalized fingerprint (`tax/email/phone/name+address heuristics`).
- Party merge flow moves child references (addresses/contacts), marks source merged, writes merge history.
- Number-series `next` allocation uses DB transaction + `FOR UPDATE` lock + atomic counter increment.

## Privacy and Audit
- Party/contact/address fields are treated as sensitive.
- Audit entries are emitted for party create/update/merge and number-series allocations.
- Merge operations preserve traceability via dedicated merge-history records.

## Workflow + Metadata Integration
- Party/Item/PriceList status transitions enforce published workflow transitions when present.
- Party and Item `customData` is validated against published compiled metadata schemas.
