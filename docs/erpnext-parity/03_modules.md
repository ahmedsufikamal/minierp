# Module Delivery Contracts

Each module section defines:

- Routes/screens
- Key workflows
- Required reports
- Required integrations
- Acceptance tests

Canonical UI route map now lives in `docs/erpnext-parity/07_ui-route-map.md`.
Legacy non-namespaced routes are migration redirects and should not be treated as canonical parity UI paths.

## Accounting

- Routes/screens:
  - Existing: `/accounting`, `/accounting/coa`, `/accounting/journal-entries`, `/accounting/gl`, `/accounting/periods`
  - API: `/api/v1/accounting/accounts`, `/api/v1/accounting/journal-entries`, `/api/v1/accounting/gl`, `/api/v1/accounting/fiscal-years`, `/api/v1/accounting/periods`, `/api/v1/accounting/reports`
- Workflows:
  - draft journal -> submit/post (balanced lines only)
  - sales/purchase invoice posting -> GL
  - period close/open controls
- Reports:
  - trial balance, P&L, balance sheet, GL detail
- Integrations:
  - immutable ledger event stream + outbox on posted journal
  - bank import (phase 3)
- Acceptance tests:
  - balanced journal posts successfully
  - posting in closed period fails
  - unbalanced journal is rejected
  - unauthorized user cannot post

## Buying (Procurement)

- Routes/screens:
  - Existing: `/vendors`, `/purchase-orders`, `/bills`
  - Existing API: `/api/v1/buying/material-requests`, `/api/v1/buying/rfqs`, `/api/v1/buying/supplier-quotations`, `/api/v1/buying/purchase-receipts`
- Workflows:
  - supplier -> material request -> PO -> receipt -> purchase invoice -> payment
- Reports:
  - supplier aging, purchase register, GRN pending invoice
- Integrations:
  - supplier email templates, import tools
- Acceptance tests:
  - partial receipt updates PO status
  - invoice cannot exceed received qty (configurable)
  - unauthorized approval blocked

## Selling

- Routes/screens:
  - Existing: `/customers`, `/quotes`, `/invoices`, `/payments`
  - Existing API: `/api/v1/selling/sales-orders`, `/api/v1/selling/delivery-notes`
- Workflows:
  - lead/opportunity -> quotation -> sales order -> delivery -> invoice -> payment
- Reports:
  - sales register, receivables aging, item-wise sales
- Integrations:
  - email quote/invoice, payment gateway hooks
- Acceptance tests:
  - quote to invoice conversion success
  - delivery required before invoice when policy enabled
  - user without sales write denied

## CRM

- Routes/screens:
  - Existing API: `/api/v1/crm/campaigns`, `/api/v1/crm/leads`, `/api/v1/crm/opportunities`, `/api/v1/crm/timeline`
- Workflows:
  - lead qualification -> opportunity stages -> won/lost
- Reports:
  - funnel conversion, activity aging
- Integrations:
  - email logging hooks, calendar sync hooks
- Acceptance tests:
  - stage transition history recorded
  - closed-lost reason required by policy
  - permission-restricted pipeline visibility

## Stock (Inventory)

- Routes/screens:
  - Existing: `/inventory`, `/inventory/items`, `/inventory/warehouses`, `/inventory/locations`, `/inventory/documents`, `/inventory/ledger`, `/inventory/reorder`, `/inventory/settings`
- Workflows:
  - document states with approvals and posting
  - stock reconciliation and transfer flows
- Reports:
  - stock balance, stock ledger, reorder suggestions
- Integrations:
  - import/export jobs, barcodes, webhook subscriptions
- Acceptance tests:
  - approved document posts ledger and balances
  - negative stock blocked when policy active
  - invalid transition rejected

## Setup

- Routes/screens:
  - API: `/api/v1/setup/item-groups`, `/api/v1/setup/uoms`, `/api/v1/setup/territories`, `/api/v1/setup/customer-groups`, `/api/v1/setup/supplier-groups`
- Workflows:
  - create/update company-scoped master data for stock and party classification
- Reports:
  - setup master completeness report (phase 3)
- Integrations:
  - downstream entity references (`Product`, `Customer`, `Vendor`)
- Acceptance tests:
  - item group parent/child hierarchy enforces same-company parent
  - UOM uniqueness is scoped by tenant+company
  - inactive master filtering is honored on list endpoints

## Manufacturing

- Routes/screens:
  - Existing API: `/api/v1/manufacturing/boms`, `/api/v1/manufacturing/routings`, `/api/v1/manufacturing/work-orders`, `/api/v1/manufacturing/job-cards`
  - Existing API: `/api/v1/subcontracting/orders`, `/api/v1/subcontracting/receipts`, `/api/v1/quality/inspections`, `/api/v1/quality/capas`
- Workflows:
  - BOM versioning -> work order -> material issue -> production receipt
- Reports:
  - WIP summary, capacity utilization, production variance
- Integrations:
  - stock and quality inspections
- Acceptance tests:
  - work order reserves required materials
  - cannot finish without operation completion
  - unauthorized workstation action blocked

## Projects

- Routes/screens:
  - Existing API: `/api/v1/projects/projects`, `/api/v1/projects/tasks`, `/api/v1/projects/timesheets`
- Workflows:
  - project -> tasks -> timesheet -> billing linkage
- Reports:
  - project profitability, timesheet utilization
- Integrations:
  - sales invoice linkage
- Acceptance tests:
  - timesheet approval required before billing
  - archived project rejects new tasks
  - row-scope by project enforced

## Assets

- Routes/screens:
  - Existing API: `/api/v1/assets/categories`, `/api/v1/assets/assets`, `/api/v1/maintenance/schedules`, `/api/v1/maintenance/visits`, `/api/v1/regional/profiles`
- Workflows:
  - acquisition -> capitalization -> depreciation -> disposal
- Reports:
  - fixed asset register, depreciation schedule
- Integrations:
  - accounting journal posting
- Acceptance tests:
  - depreciation run posts expected entries
  - disposed asset blocks further depreciation
  - unauthorized disposal blocked

## POS

- Routes/screens:
  - Existing API: `/api/v1/pos/profiles`, `/api/v1/pos/shifts`, `/api/v1/pos/sales`
  - Existing API: `/api/v1/portal/configs`
- Workflows:
  - cart -> payment -> invoice posting -> stock deduction -> shift close
- Reports:
  - POS sales summary, cashier variance
- Integrations:
  - barcode scan, payment providers
- Acceptance tests:
  - POS sale decrements stock and creates invoice
  - insufficient stock blocks sale
  - unauthorized cashier cannot close shift

## Quality

- Routes/screens:
  - Existing API: `/api/v1/quality/inspections`, `/api/v1/quality/capas`
- Workflows:
  - inbound/production inspection with pass/fail and CAPA linkage
- Reports:
  - defect trend, supplier quality score
- Integrations:
  - purchase receipt, work order
- Acceptance tests:
  - failed inspection blocks downstream posting by policy
  - re-inspection updates status and audit timeline
  - unauthorized inspector blocked

## Support

- Routes/screens:
  - Existing API: `/api/v1/support/queues`, `/api/v1/support/sla-policies`, `/api/v1/support/tickets`
  - Existing API: `/api/v1/communication/windows`, `/api/v1/communication/logs`, `/api/v1/telephony/call-logs`
- Workflows:
  - ticket create -> assign -> SLA monitor -> resolve/close
- Reports:
  - SLA breach report, response/resolution time
- Integrations:
  - inbound email to ticket, webhook notifications
- Acceptance tests:
  - SLA clock pauses on waiting states
  - closed ticket transition denied without reopen
  - permission-scope by queue/team enforced

## Source Long-tail Modules (Portal/Utilities/Maintenance/Regional/Communication/Telephony/Bulk/EDI/Subcontracting)

- Routes/screens:
  - Existing API: `/api/v1/portal/configs`, `/api/v1/utilities/tasks`, `/api/v1/maintenance/schedules`, `/api/v1/maintenance/visits`, `/api/v1/regional/profiles`
  - Existing API: `/api/v1/communication/windows`, `/api/v1/communication/logs`, `/api/v1/telephony/call-logs`, `/api/v1/bulk/jobs`, `/api/v1/edi/code-lists`, `/api/v1/edi/transports`, `/api/v1/subcontracting/orders`, `/api/v1/subcontracting/receipts`
- Workflows:
  - admin utility operations, maintenance lifecycle, communication/call operations, bulk and EDI processing, subcontracting order/receipt chain
- Reports:
  - module-specific logs and reconciliation reports
- Integrations:
  - scheduler/jobs, webhook/email connectors, transport adapters
- Acceptance tests:
  - module endpoints enforce tenant/company scope
  - unsafe batch/EDI execution is rejected
  - audit trail exists for all mutation paths

## HR & Payroll

- Routes/screens:
  - Existing API: `/api/v1/hr/employees`, `/api/v1/hr/leaves/allocations`, `/api/v1/hr/leaves/applications`, `/api/v1/hr/attendance`, `/api/v1/hr/expense-claims`
  - Existing API: `/api/v1/payroll/salary-structures`, `/api/v1/payroll/entries`, `/api/v1/payroll/payslips`
- Workflows:
  - employee onboarding -> leave/attendance -> payroll run -> payslip
- Reports:
  - attendance summary, payroll register
- Integrations:
  - accounting postings, statutory adapters
- Acceptance tests:
  - payroll run generates payslips for eligible employees
  - missing salary structure blocks payroll
  - non-HR role cannot approve leave

## No-code customization

- Routes/screens:
  - Existing: inventory settings custom fields/workflows/labels
  - Planned: `/customization/fields`, `/customization/forms`, `/customization/workflows`, `/customization/print`, `/customization/automation`
- Workflows:
  - metadata authoring -> publish -> runtime rendering/enforcement
- Reports:
  - metadata usage and automation execution logs
- Integrations:
  - PDF render hook, event bus triggers
- Acceptance tests:
  - custom field renders and persists on standard entity
  - invalid metadata rejected at publish
  - unsafe automation action blocked

## Cross-module acceptance test baseline

Per module implementation, minimum coverage:

1. 3 happy-path end-to-end tests.
2. 2 negative-path tests (permissions, invalid workflow transitions, stock/period constraints, etc.).
3. Pagination and index-backed list/report endpoint checks.
