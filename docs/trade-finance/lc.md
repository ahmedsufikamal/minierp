# Trade Finance LC

The Letter of Credit (LC) module introduces tenant-scoped Import LC operations under `/trade/lc`.

## Data Model

- `TradeLc` stores the core LC header, parties, bank references, shipment/expiry dates, and optimistic `version`.
- `TradeLcPoLink` links optional purchase orders and covered amounts.
- `TradeLcAmendment` stores structured amendment diffs and publish state.
- `TradeLcDocumentSet` and `TradeLcDocumentLine` model document receipt and checklist verification.
- `TradeLcDiscrepancy` tracks scrutiny exceptions and decisions.
- `TradeLcCharge` and `TradeLcPayment` maintain the internal LC financial ledger.
- `TradeLcEvent` is the timeline/event stream.
- `TradeLcAttachment` stores LC-specific attachment metadata and signed storage keys.
- `TradeLcSetting`, `TradeLcBank`, `TradeLcDocumentType`, `TradeLcChargeType`, and `TradeLcIncoterm` are tenant/company-scoped masters.

## Workflow

- `DRAFT -> REQUESTED -> APPROVED -> ISSUED`
- Post-issue operational states: `ACTIVE`, `DOCS_RECEIVED`, `UNDER_SCRUTINY`, `DISCREPANT`, `ACCEPTED`, `SETTLED`
- Terminal states: `CLOSED`, `CANCELLED`
- `EXPIRED` is computed for still-open LCs whose `expiryDate` is in the past.

Key server-side rules:

- Only draft LCs are editable.
- Approval enforces dual control when enabled in LC settings.
- Issue allocates the `TRADE_LC` numbering series and stamps `issueDate`.
- Required document lines must be received before verification.
- All open discrepancies must be resolved and settlement must be fully paid before close.

## API Endpoints

Base: `/api/v1/trade/lc`

- Core: dashboard, register, form-options, CRUD, submit/approve/issue/cancel/close
- Amendments: aggregate list, per-LC list/create, publish
- Documents: aggregate queue, per-LC list/create, docset detail/update, verify, mark-discrepant
- Discrepancies: aggregate queue, per-LC list/create, patch, waive, reject
- Charges & Payments: aggregate queues, per-LC list/create, mark-paid
- Reports: register, expiry, outstanding, charges, discrepancies (`format=csv` supported)
- Settings: LC controls plus banks, document types, charge types, incoterms
- Attachments: list, upload-url, finalize, download-url

## UI Routes

- `/trade/lc`
- `/trade/lc/register`
- `/trade/lc/new`
- `/trade/lc/[id]`
- `/trade/lc/amendments`
- `/trade/lc/documents`
- `/trade/lc/discrepancies`
- `/trade/lc/charges-payments`
- `/trade/lc/reports`
- `/trade/lc/settings`
