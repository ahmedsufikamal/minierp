# UI Route Map and Theme Contract

This document is the canonical UI/UX map for ERPNext parity modules.

## Theme contract

Theme modes exposed in UI:

- `Light`
- `Dark`
- `Automatic (System)`

Persistence contract:

- Prisma enum: `ThemeMode = LIGHT | DARK | SYSTEM`
- User column: `User.uiThemePreference`
- API: `GET/PATCH /api/account/preferences`
- Bootstrap: user preference hydrates `next-themes` at app load
- Fallback: local state remains active if preference sync request fails

## Route IA baseline

Canonical module routes are namespaced under `src/app/(app)` and mirror module APIs.

### Setup
- `/setup/item-groups`
- `/setup/uoms`
- `/setup/territories`
- `/setup/customer-groups`
- `/setup/supplier-groups`

### Stock
- `/stock/overview`
- `/stock/items`
- `/stock/warehouses`
- `/stock/documents`
- `/stock/ledger`
- `/stock/reorder`
- `/stock/settings`

### Accounting
- `/accounting/coa`
- `/accounting/journal-entries`
- `/accounting/gl`
- `/accounting/periods`
- `/accounting/payment-entries`

### Selling
- `/selling/customers`
- `/selling/quotations`
- `/selling/sales-orders`
- `/selling/delivery-notes`
- `/selling/sales-invoices`
- `/selling/receivables`

### CRM
- `/crm/leads`
- `/crm/opportunities`
- `/crm/pipeline`
- `/crm/campaigns`
- `/crm/timeline`

### Buying
- `/buying/suppliers`
- `/buying/material-requests`
- `/buying/rfqs`
- `/buying/supplier-quotations`
- `/buying/purchase-orders`
- `/buying/purchase-receipts`
- `/buying/purchase-invoices`
- `/buying/payables`

### Manufacturing and Subcontracting
- `/manufacturing/boms`
- `/manufacturing/routings`
- `/manufacturing/work-orders`
- `/manufacturing/job-cards`
- `/subcontracting/orders`
- `/subcontracting/receipts`

### Quality and Projects
- `/quality/inspections`
- `/quality/capas`
- `/quality/goals`
- `/projects/projects`
- `/projects/tasks`
- `/projects/timesheets`
- `/projects/billing`

### Support, Communication, Telephony
- `/support/queues`
- `/support/slas`
- `/support/tickets`
- `/support/knowledge-base`
- `/communication/windows`
- `/communication/logs`
- `/telephony/call-logs`

### HR and Payroll
- `/hr/employees`
- `/hr/leaves`
- `/hr/attendance`
- `/hr/expense-claims`
- `/payroll/salary-structures`
- `/payroll/entries`
- `/payroll/payslips`

### Assets, Maintenance, Regional
- `/assets/categories`
- `/assets/assets`
- `/assets/depreciation`
- `/maintenance/schedules`
- `/maintenance/visits`
- `/regional/profiles`

### POS and Portal
- `/pos/profiles`
- `/pos/shifts`
- `/pos/sales`
- `/pos/closing`
- `/portal/configs`

### Integrations, EDI, Bulk, Utilities
- `/integrations/email-templates`
- `/integrations/email-queue`
- `/integrations/api-tokens`
- `/integrations/webhooks`
- `/integrations/import-export`
- `/edi/code-lists`
- `/edi/transports`
- `/edi/mappings`
- `/bulk/jobs`
- `/utilities/tasks`
- `/utilities/admin-tools`

### Platform customization
- `/platform/reports`
- `/platform/settings`
- `/platform/customization/custom-fields`
- `/platform/customization/form-layouts`
- `/platform/customization/validation-rules`
- `/platform/customization/automation-rules`
- `/platform/customization/print-templates`

## Legacy redirects

Legacy paths currently redirect to canonical module paths:

- `/customers` -> `/selling/customers`
- `/quotes` -> `/selling/quotations`
- `/invoices` -> `/selling/sales-invoices`
- `/vendors` -> `/buying/suppliers`
- `/purchase-orders` -> `/buying/purchase-orders`
- `/bills` -> `/buying/purchase-invoices`
- `/payments` -> `/accounting/payment-entries`
- `/inventory` -> `/stock/overview`
- `/inventory/items` -> `/stock/items`
- `/inventory/warehouses` -> `/stock/warehouses`
- `/inventory/documents` -> `/stock/documents`
- `/inventory/ledger` -> `/stock/ledger`
- `/inventory/reorder` -> `/stock/reorder`
- `/inventory/settings` -> `/stock/settings`
- `/reports` -> `/platform/reports`

## Implementation state

- Existing legacy functional pages are preserved via wrappers where available.
- Missing module pages are scaffolded using a module placeholder so all canonical routes are addressable.
- Remaining parity work is to replace placeholders with full API-first module workbenches and advanced UX flows.
