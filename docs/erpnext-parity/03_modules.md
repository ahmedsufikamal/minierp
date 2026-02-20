# Module Delivery Contracts

Each module section defines:
- Routes/screens
- Key workflows
- Required reports
- Required integrations
- Acceptance tests

## Accounting
- Routes/screens:
  - Existing: `/accounting`
  - Planned: `/accounting/coa`, `/accounting/journal-entries`, `/accounting/period-close`
- Workflows:
  - draft journal -> approve -> post
  - sales/purchase invoice posting -> GL
  - period close/open controls
- Reports:
  - trial balance, P&L, balance sheet, GL detail
- Integrations:
  - bank import (phase 3), webhook on posted entry
- Acceptance tests:
  - balanced journal posts successfully
  - posting in closed period fails
  - unauthorized user cannot post

## Buying (Procurement)
- Routes/screens:
  - Existing: `/vendors`, `/purchase-orders`, `/bills`
  - Planned: `/buying/material-requests`, `/buying/purchase-receipts`
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
  - Planned: `/selling/sales-orders`, `/selling/delivery-notes`
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
  - Existing: customer detail tabs and opportunity/activity primitives
  - Planned: `/crm/leads`, `/crm/opportunities`, `/crm/pipeline`
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

## Manufacturing
- Routes/screens:
  - Planned: `/manufacturing/boms`, `/manufacturing/work-orders`, `/manufacturing/routings`
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
  - Planned: `/projects`, `/projects/tasks`, `/projects/timesheets`
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
  - Planned: `/assets`, `/assets/categories`, `/assets/depreciation`
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
  - Planned: `/pos`
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
  - Planned: `/quality/inspections`, `/quality/goals`
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
  - Planned: `/support/tickets`, `/support/slas`, `/support/knowledge-base`
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

## HR & Payroll
- Routes/screens:
  - Planned: `/hr/employees`, `/hr/leave`, `/hr/attendance`, `/payroll`
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
