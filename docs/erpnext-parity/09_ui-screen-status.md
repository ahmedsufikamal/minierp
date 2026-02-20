# UI Screen Status Tracker

Status legend:

- `baseline`: functional API-first screen exists (list/detail/create/action baseline)
- `deep`: advanced UX parity implemented
- `legacy`: wrapper/redirect to legacy non-canonical screen

## Canonical module routes

| Route | Status | Data source | Notes |
|---|---|---|---|
| `/setup/item-groups` | `baseline` | `/api/v1/setup/item-groups` | API workbench baseline |
| `/setup/uoms` | `baseline` | `/api/v1/setup/uoms` | API workbench baseline |
| `/setup/territories` | `baseline` | `/api/v1/setup/territories` | API workbench baseline |
| `/setup/customer-groups` | `baseline` | `/api/v1/setup/customer-groups` | API workbench baseline |
| `/setup/supplier-groups` | `baseline` | `/api/v1/setup/supplier-groups` | API workbench baseline |
| `/stock/overview` | `legacy` | mixed | Wrapper to inventory overview |
| `/stock/items` | `legacy` | mixed | Wrapper to inventory items |
| `/stock/warehouses` | `legacy` | mixed | Wrapper to inventory warehouses |
| `/stock/documents` | `legacy` | mixed | Wrapper to inventory documents |
| `/stock/ledger` | `legacy` | mixed | Wrapper to inventory ledger |
| `/stock/reorder` | `legacy` | mixed | Wrapper to inventory reorder |
| `/stock/settings` | `legacy` | mixed | Wrapper to inventory settings |
| `/accounting/coa` | `baseline` | `/api/v1/accounting/accounts` | API workbench baseline |
| `/accounting/journal-entries` | `baseline` | `/api/v1/accounting/journal-entries` | API workbench baseline |
| `/accounting/gl` | `baseline` | `/api/v1/accounting/gl` | GL inspector baseline with currency/dimension traces |
| `/accounting/periods` | `baseline` | `/api/v1/accounting/periods` | API workbench baseline |
| `/accounting/payment-entries` | `baseline` | `/api/v1/accounting/payment-entries` | Payment entry baseline |
| `/selling/customers` | `legacy` | wrapper | Wrapper to existing customers page |
| `/selling/quotations` | `legacy` | wrapper | Wrapper to existing quotes page |
| `/selling/sales-orders` | `baseline` | `/api/v1/selling/sales-orders` | API workbench baseline |
| `/selling/delivery-notes` | `baseline` | `/api/v1/selling/delivery-notes` | API workbench baseline |
| `/selling/sales-invoices` | `legacy` | wrapper | Wrapper to existing invoices page |
| `/selling/receivables` | `baseline` | `/api/v1/accounting/reports` | Uses accounting reports endpoint until AR aging API lands |
| `/crm/leads` | `baseline` | `/api/v1/crm/leads` | API workbench baseline |
| `/crm/opportunities` | `baseline` | `/api/v1/crm/opportunities` | API workbench baseline |
| `/crm/pipeline` | `baseline` | `/api/v1/crm/opportunities` | Drag/drop parity pending |
| `/crm/campaigns` | `baseline` | `/api/v1/crm/campaigns` | API workbench baseline |
| `/crm/timeline` | `baseline` | `/api/v1/crm/timeline` | API workbench baseline |
| `/buying/suppliers` | `legacy` | wrapper | Wrapper to existing vendors page |
| `/buying/material-requests` | `baseline` | `/api/v1/buying/material-requests` | API workbench baseline |
| `/buying/rfqs` | `baseline` | `/api/v1/buying/rfqs` | API workbench baseline |
| `/buying/supplier-quotations` | `baseline` | `/api/v1/buying/supplier-quotations` | API workbench baseline |
| `/buying/purchase-orders` | `legacy` | wrapper | Wrapper to existing purchase-orders page |
| `/buying/purchase-receipts` | `baseline` | `/api/v1/buying/purchase-receipts` | API workbench baseline |
| `/buying/purchase-invoices` | `legacy` | wrapper | Wrapper to existing bills page |
| `/buying/payables` | `baseline` | `/api/v1/accounting/reports` | Uses accounting reports endpoint until AP aging API lands |
| `/manufacturing/boms` | `baseline` | `/api/v1/manufacturing/boms` | API workbench baseline |
| `/manufacturing/routings` | `baseline` | `/api/v1/manufacturing/routings` | API workbench baseline |
| `/manufacturing/work-orders` | `baseline` | `/api/v1/manufacturing/work-orders` | API workbench baseline |
| `/manufacturing/job-cards` | `baseline` | `/api/v1/manufacturing/job-cards` | API workbench baseline |
| `/subcontracting/orders` | `baseline` | `/api/v1/subcontracting/orders` | API workbench baseline |
| `/subcontracting/receipts` | `baseline` | `/api/v1/subcontracting/receipts` | API workbench baseline |
| `/quality/inspections` | `baseline` | `/api/v1/quality/inspections` | API workbench baseline |
| `/quality/capas` | `baseline` | `/api/v1/quality/capas` | API workbench baseline |
| `/quality/goals` | `baseline` | `/api/v1/quality/goals` | Not-started parity row closure pending |
| `/projects/projects` | `baseline` | `/api/v1/projects/projects` | API workbench baseline |
| `/projects/tasks` | `baseline` | `/api/v1/projects/tasks` | API workbench baseline |
| `/projects/timesheets` | `baseline` | `/api/v1/projects/timesheets` | API workbench baseline |
| `/projects/billing` | `baseline` | `/api/v1/projects/billing` | Not-started parity row closure pending |
| `/support/queues` | `baseline` | `/api/v1/support/queues` | API workbench baseline |
| `/support/slas` | `baseline` | `/api/v1/support/sla-policies` | API workbench baseline |
| `/support/tickets` | `baseline` | `/api/v1/support/tickets` | API workbench baseline |
| `/support/knowledge-base` | `baseline` | `/api/v1/support/knowledge-base` | Not-started parity row closure pending |
| `/communication/windows` | `baseline` | `/api/v1/communication/windows` | API workbench baseline |
| `/communication/logs` | `baseline` | `/api/v1/communication/logs` | API workbench baseline |
| `/telephony/call-logs` | `baseline` | `/api/v1/telephony/call-logs` | API workbench baseline |
| `/hr/employees` | `baseline` | `/api/v1/hr/employees` | API workbench baseline |
| `/hr/leaves` | `baseline` | `/api/v1/hr/leaves/allocations` | API workbench baseline |
| `/hr/attendance` | `baseline` | `/api/v1/hr/attendance` | API workbench baseline |
| `/hr/expense-claims` | `baseline` | `/api/v1/hr/expense-claims` | API workbench baseline |
| `/payroll/salary-structures` | `baseline` | `/api/v1/payroll/salary-structures` | API workbench baseline |
| `/payroll/entries` | `baseline` | `/api/v1/payroll/entries` | API workbench baseline |
| `/payroll/payslips` | `baseline` | `/api/v1/payroll/payslips` | API workbench baseline |
| `/assets/categories` | `baseline` | `/api/v1/assets/categories` | API workbench baseline |
| `/assets/assets` | `baseline` | `/api/v1/assets/assets` | API workbench baseline |
| `/assets/depreciation` | `baseline` | `/api/v1/assets/assets` | Depreciation deep UX pending |
| `/maintenance/schedules` | `baseline` | `/api/v1/maintenance/schedules` | API workbench baseline |
| `/maintenance/visits` | `baseline` | `/api/v1/maintenance/visits` | API workbench baseline |
| `/regional/profiles` | `baseline` | `/api/v1/regional/profiles` | API workbench baseline |
| `/pos/profiles` | `baseline` | `/api/v1/pos/profiles` | API workbench baseline |
| `/pos/shifts` | `baseline` | `/api/v1/pos/shifts` | API workbench baseline |
| `/pos/sales` | `baseline` | `/api/v1/pos/sales` | API workbench baseline |
| `/pos/closing` | `baseline` | `/api/v1/pos/shifts` | Shift close deep UX pending |
| `/portal/configs` | `baseline` | `/api/v1/portal/configs` | API workbench baseline |
| `/integrations/email-templates` | `baseline` | `/api/v1/integrations/email-templates` | API workbench baseline |
| `/integrations/email-queue` | `baseline` | `/api/v1/integrations/email-queue` | API workbench baseline |
| `/integrations/api-tokens` | `baseline` | `/api/v1/integrations/api-tokens` | API workbench baseline |
| `/integrations/webhooks` | `baseline` | `/api/v1/integrations/api-tokens` | Dedicated webhook API pending |
| `/integrations/import-export` | `baseline` | `/api/v1/integrations/email-queue` | Dedicated import/export API pending |
| `/edi/code-lists` | `baseline` | `/api/v1/edi/code-lists` | API workbench baseline |
| `/edi/transports` | `baseline` | `/api/v1/edi/transports` | API workbench baseline |
| `/edi/mappings` | `baseline` | `/api/v1/edi/code-lists` | Dedicated mappings API pending |
| `/bulk/jobs` | `baseline` | `/api/v1/bulk/jobs` | API workbench baseline |
| `/utilities/tasks` | `baseline` | `/api/v1/utilities/tasks` | API workbench baseline |
| `/utilities/admin-tools` | `baseline` | `/api/v1/utilities/tasks` | Admin tooling deep UX pending |
| `/platform/customization/custom-fields` | `baseline` | `/api/v1/platform/customization/custom-fields` | API workbench baseline |
| `/platform/customization/form-layouts` | `baseline` | `/api/v1/platform/customization/form-layouts` | No-code runtime closure pending |
| `/platform/customization/validation-rules` | `baseline` | `/api/v1/platform/customization/validation-rules` | API workbench baseline |
| `/platform/customization/automation-rules` | `baseline` | `/api/v1/platform/customization/automation-rules` | No-code runtime closure pending |
| `/platform/customization/print-templates` | `baseline` | `/api/v1/platform/customization/print-templates` | API workbench baseline |

## Baseline completion definition

A route is `baseline` when it provides:

1. API-backed list view with pagination/filter/search.
2. Detail snapshot for selected row.
3. Create flow to canonical `POST` endpoint.
4. Workflow action trigger against `/:id/actions` when supported.
5. Scope visibility (`tenantId` and `companyId`) when available.
