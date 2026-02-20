# miniERP API (v1)

Optional REST API for integrations. All endpoints require authentication.

## Authentication

Set one of:

- **Header:** `Authorization: Bearer YOUR_API_KEY`
- **Query:** `?apiKey=YOUR_API_KEY`

Environment variables:

- `API_KEY` – required for API access; set in `.env`. If unset, all API routes return 401.
- `API_ORG_ID` – org scope for API data (default: `default-org`).

## Endpoints

Base URL: `/api/v1`

### GET /api/v1/customers

Returns up to 100 customers for the configured org.

**Response:** `{ "data": [ { "id", "orgId", "name", "email", "phone", "address", "createdAt", "updatedAt" }, ... ] }`

### POST /api/v1/customers

Create a customer.

**Body (JSON):**

- `name` (string, required)
- `email` (string, optional)
- `phone` (string, optional)
- `address` (string, optional)

**Response:** `{ "data": { "id", "orgId", "name", ... } }`

### GET /api/v1/products

Returns up to 100 products for the configured org.

**Response:** `{ "data": [ { "id", "orgId", "sku", "name", "unit", "priceCents", ... }, ... ] }`

### Accounting MVP (Phase 2 Wave 1)

These endpoints use session auth + IAM permissions (`finance.*` compatibility is supported):

- `GET /api/v1/accounting/accounts`
- `POST /api/v1/accounting/accounts`
- `GET /api/v1/accounting/journal-entries`
- `POST /api/v1/accounting/journal-entries`
- `PATCH /api/v1/accounting/journal-entries` (submit/post)
- `GET /api/v1/accounting/gl`
- `GET /api/v1/accounting/fiscal-years`
- `POST /api/v1/accounting/fiscal-years`
- `GET /api/v1/accounting/periods`
- `POST /api/v1/accounting/periods`
- `PATCH /api/v1/accounting/periods` (open/close)
- `GET /api/v1/accounting/reports?reportKey=trial-balance|profit-loss|balance-sheet`

### Stock MVP Completion (Phase 2 Wave 2, baseline)

These inventory endpoints are now available for Wave 2 scope:

- `POST /api/v1/inventory/reconciliation/preview`
- `POST /api/v1/inventory/reconciliation`
- `GET /api/v1/inventory/reservations`
- `POST /api/v1/inventory/reservations`
- `POST /api/v1/inventory/reservations/{reservationId}/release`

### Setup Master Data Baseline (Phase 2 Wave 2 extension)

These setup endpoints are now available for company master data:

- `GET /api/v1/setup/item-groups`
- `POST /api/v1/setup/item-groups`
- `GET /api/v1/setup/uoms`
- `POST /api/v1/setup/uoms`
- `GET /api/v1/setup/territories`
- `POST /api/v1/setup/territories`
- `GET /api/v1/setup/customer-groups`
- `POST /api/v1/setup/customer-groups`
- `GET /api/v1/setup/supplier-groups`
- `POST /api/v1/setup/supplier-groups`

### Selling Wave 3 (baseline)

- `GET /api/v1/selling/sales-orders`
- `POST /api/v1/selling/sales-orders`
- `PATCH /api/v1/selling/sales-orders/{salesOrderId}/actions`
- `GET /api/v1/selling/delivery-notes`
- `POST /api/v1/selling/delivery-notes`
- `PATCH /api/v1/selling/delivery-notes/{deliveryNoteId}/actions`

### Buying Wave 4 (baseline)

- `GET /api/v1/buying/material-requests`
- `POST /api/v1/buying/material-requests`
- `PATCH /api/v1/buying/material-requests/{materialRequestId}/actions`
- `GET /api/v1/buying/rfqs`
- `POST /api/v1/buying/rfqs`
- `PATCH /api/v1/buying/rfqs/{rfqId}/actions`
- `GET /api/v1/buying/supplier-quotations`
- `POST /api/v1/buying/supplier-quotations`
- `PATCH /api/v1/buying/supplier-quotations/{supplierQuotationId}/actions`
- `GET /api/v1/buying/purchase-receipts`
- `POST /api/v1/buying/purchase-receipts`
- `PATCH /api/v1/buying/purchase-receipts/{purchaseReceiptId}/actions`

### CRM Wave 5 (baseline)

- `GET /api/v1/crm/campaigns`
- `POST /api/v1/crm/campaigns`
- `PATCH /api/v1/crm/campaigns/{campaignId}/actions`
- `GET /api/v1/crm/leads`
- `POST /api/v1/crm/leads`
- `PATCH /api/v1/crm/leads/{leadId}/actions`
- `GET /api/v1/crm/opportunities`
- `POST /api/v1/crm/opportunities`
- `PATCH /api/v1/crm/opportunities/{opportunityId}/actions`
- `GET /api/v1/crm/timeline`

### Manufacturing/Subcontracting/Quality Wave 6 (baseline)

- `GET /api/v1/manufacturing/boms`
- `POST /api/v1/manufacturing/boms`
- `PATCH /api/v1/manufacturing/boms/{bomId}/actions`
- `GET /api/v1/manufacturing/routings`
- `POST /api/v1/manufacturing/routings`
- `GET /api/v1/manufacturing/work-orders`
- `POST /api/v1/manufacturing/work-orders`
- `PATCH /api/v1/manufacturing/work-orders/{workOrderId}/actions`
- `GET /api/v1/manufacturing/job-cards`
- `POST /api/v1/manufacturing/job-cards`
- `PATCH /api/v1/manufacturing/job-cards/{jobCardId}/actions`
- `GET /api/v1/subcontracting/orders`
- `POST /api/v1/subcontracting/orders`
- `PATCH /api/v1/subcontracting/orders/{orderId}/actions`
- `GET /api/v1/subcontracting/receipts`
- `POST /api/v1/subcontracting/receipts`
- `PATCH /api/v1/subcontracting/receipts/{receiptId}/actions`
- `GET /api/v1/quality/inspections`
- `POST /api/v1/quality/inspections`
- `PATCH /api/v1/quality/inspections/{inspectionId}/actions`
- `GET /api/v1/quality/capas`
- `POST /api/v1/quality/capas`
- `PATCH /api/v1/quality/capas/{capaId}/actions`

### Projects/Support/Communication/Telephony Wave 7 (baseline)

- `GET /api/v1/projects/projects`
- `POST /api/v1/projects/projects`
- `PATCH /api/v1/projects/projects/{projectId}/actions`
- `GET /api/v1/projects/tasks`
- `POST /api/v1/projects/tasks`
- `PATCH /api/v1/projects/tasks/{taskId}/actions`
- `GET /api/v1/projects/timesheets`
- `POST /api/v1/projects/timesheets`
- `PATCH /api/v1/projects/timesheets/{timesheetId}/actions`
- `GET /api/v1/support/queues`
- `POST /api/v1/support/queues`
- `GET /api/v1/support/sla-policies`
- `POST /api/v1/support/sla-policies`
- `GET /api/v1/support/tickets`
- `POST /api/v1/support/tickets`
- `PATCH /api/v1/support/tickets/{ticketId}/actions`
- `GET /api/v1/communication/windows`
- `POST /api/v1/communication/windows`
- `GET /api/v1/communication/logs`
- `POST /api/v1/communication/logs`
- `GET /api/v1/telephony/call-logs`
- `POST /api/v1/telephony/call-logs`
- `PATCH /api/v1/telephony/call-logs/{callLogId}/actions`

### HR/Payroll Wave 8 (baseline)

- `GET /api/v1/hr/employees`
- `POST /api/v1/hr/employees`
- `GET /api/v1/hr/leaves/allocations`
- `POST /api/v1/hr/leaves/allocations`
- `GET /api/v1/hr/leaves/applications`
- `POST /api/v1/hr/leaves/applications`
- `PATCH /api/v1/hr/leaves/applications/{applicationId}/actions`
- `GET /api/v1/hr/attendance`
- `POST /api/v1/hr/attendance`
- `GET /api/v1/hr/expense-claims`
- `POST /api/v1/hr/expense-claims`
- `PATCH /api/v1/hr/expense-claims/{claimId}/actions`
- `GET /api/v1/payroll/salary-structures`
- `POST /api/v1/payroll/salary-structures`
- `GET /api/v1/payroll/entries`
- `POST /api/v1/payroll/entries`
- `PATCH /api/v1/payroll/entries/{entryId}/actions`
- `GET /api/v1/payroll/payslips`
- `POST /api/v1/payroll/payslips`
- `PATCH /api/v1/payroll/payslips/{payslipId}/actions`

### Assets/Maintenance/Regional Wave 9 (baseline)

- `GET /api/v1/assets/categories`
- `POST /api/v1/assets/categories`
- `GET /api/v1/assets/assets`
- `POST /api/v1/assets/assets`
- `PATCH /api/v1/assets/assets/{assetId}/actions`
- `GET /api/v1/maintenance/schedules`
- `POST /api/v1/maintenance/schedules`
- `PATCH /api/v1/maintenance/schedules/{scheduleId}/actions`
- `GET /api/v1/maintenance/visits`
- `POST /api/v1/maintenance/visits`
- `GET /api/v1/regional/profiles`
- `POST /api/v1/regional/profiles`
- `PATCH /api/v1/regional/profiles/{profileId}/actions`

### POS/Portal Wave 10 (baseline)

- `GET /api/v1/pos/profiles`
- `POST /api/v1/pos/profiles`
- `GET /api/v1/pos/shifts`
- `POST /api/v1/pos/shifts`
- `PATCH /api/v1/pos/shifts/{shiftId}/actions`
- `GET /api/v1/pos/sales`
- `POST /api/v1/pos/sales`
- `PATCH /api/v1/pos/sales/{saleId}/actions`
- `GET /api/v1/portal/configs`
- `POST /api/v1/portal/configs`
- `PATCH /api/v1/portal/configs/{configId}/actions`

### Integrations/EDI/Bulk/Utilities Wave 11 (baseline)

- `GET /api/v1/integrations/email-templates`
- `POST /api/v1/integrations/email-templates`
- `GET /api/v1/integrations/email-queue`
- `POST /api/v1/integrations/email-queue`
- `GET /api/v1/integrations/api-tokens`
- `POST /api/v1/integrations/api-tokens`
- `PATCH /api/v1/integrations/api-tokens/{tokenId}/actions`
- `GET /api/v1/edi/code-lists`
- `POST /api/v1/edi/code-lists`
- `GET /api/v1/edi/transports`
- `POST /api/v1/edi/transports`
- `PATCH /api/v1/edi/transports/{transportId}/actions`
- `GET /api/v1/bulk/jobs`
- `POST /api/v1/bulk/jobs`
- `PATCH /api/v1/bulk/jobs/{jobId}/actions`
- `GET /api/v1/utilities/tasks`
- `POST /api/v1/utilities/tasks`
- `PATCH /api/v1/utilities/tasks/{taskId}/actions`

## Errors

- `401 Unauthorized` – missing or invalid API key.
- `400 Bad Request` – validation error (e.g. missing required field).
