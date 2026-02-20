# miniERP Domain Model (Tenant + Company)

## Core entities

### Tenancy and identity
- `Tenant`
  - SaaS account boundary.
  - Owns global tenant settings, plan, status, and domain mappings.
- `TenantDomain`
  - Maps hostnames/subdomains to a single tenant.
  - Used by middleware and sign-in branding resolution.
- `Company`
  - Legal/business entity under a tenant.
  - Has fiscal settings, base currency, defaults, and independent numbering series.
- `User`
  - Identity principal with platform role + tenant/company memberships.
- `TenantMembership`
  - User membership and role profile at tenant level.
- `CompanyMembership`
  - User role assignment per company.
- `RoleProfile`
  - Named reusable role bundle for permissions + row scopes.
- `PermissionRule`
  - Resource/action allow/deny rule.
- `RowScopeRule`
  - Scope filters by tenant/company/branch/warehouse/project dimensions.

### Accounting and controls
- `Account` (existing; to evolve to hierarchical COA)
- `JournalEntry`, `JournalLine` (existing)
- `GLEntry` (planned)
- `AuditEvent`
- `ImmutableLedgerEvent`
- `OutboxEvent`

### Commercial flows
- `Customer`, `Vendor` (existing)
- `Quote`, `SalesOrder` (planned), `SalesInvoice`, `Payment`
- `MaterialRequest` (planned), `PurchaseOrder`, `PurchaseReceipt` (planned), `PurchaseInvoice` (`PurchaseBill`)

### Inventory and manufacturing
- `Product` (acts as Item), `InventoryItemIdentifier`
- `InventoryWarehouse`, `InventoryWarehouseLocation`
- `InventoryDocument`, `InventoryDocumentLine`
- `InventoryLedgerEntry`, `InventoryStockBalance`
- `InventoryReorderRule`
- `BOM` (planned), `WorkOrder` (planned), `Routing` (planned)

### Projects, support, HR, assets
- `Project` (planned), `Task` (existing, to be generalized), `Timesheet` (planned)
- `SupportTicket` (planned), `SlaPolicy` (planned)
- `Employee` (planned), `Attendance` (planned), `Payslip` (planned)
- `Asset` (planned), `DepreciationSchedule` (planned)

### No-code / metadata
- `CustomField`
- `FormLayout`
- `ValidationRule`
- `WorkflowDefinition`, `WorkflowState`, `WorkflowTransition`, `WorkflowInstance`, `WorkflowAction`
- `PrintTemplate`
- `AutomationRule`
- `ReportDefinition`, `ReportView`, `ReportSchedule`
- `NumberSeries`, `NumberSeriesCounter`

## Relationship map (high-level)
- `Tenant` 1:N `TenantDomain`
- `Tenant` 1:N `Company`
- `Tenant` 1:N `TenantMembership`
- `User` 1:N `TenantMembership`
- `Company` 1:N `CompanyMembership`
- `User` 1:N `CompanyMembership`
- `RoleProfile` 1:N `PermissionRule`
- `RoleProfile` 1:N `RowScopeRule`
- Transactional entities (invoice, bill, stock docs, journals, tickets, etc.) include `tenantId` + `companyId` for deterministic scoping.
- `AuditEvent` references actor and target entity.
- `ImmutableLedgerEvent` references posting-critical entities and links by hash chain.
- `OutboxEvent` references domain events for async processors.

## Invariants
1. Every tenant-scoped record must include `tenantId`.
2. Every company-scoped record must include `companyId`, and the company must belong to the same `tenantId`.
3. Cross-tenant joins are forbidden by policy layer.
4. `JournalEntry` must balance (`sum(debit) == sum(credit)`).
5. Posted inventory/accounting records are immutable; corrections are reversal entries.
6. Workflow transition must be valid for current state and approval policy.
7. Closed fiscal periods reject posting mutations.
8. `NumberSeries` allocation must be atomic and unique per `(tenantId, companyId, key, fiscalYear)`.

## Numbering series rules
- Pattern examples:
  - `SINV-{FY}-{COMP}-{####}`
  - `PO-{YYYY}-{MM}-{#####}`
- Supported tokens (initial):
  - `{TENANT}` `{COMP}` `{FY}` `{YYYY}` `{YY}` `{MM}` `{DD}` `{####...}`
- Counter reset policies:
  - `NEVER`
  - `FISCAL_YEAR`
  - `CALENDAR_YEAR`
  - `MONTHLY`
- Allocation strategy:
  - Transactional upsert on `NumberSeriesCounter` row.
  - Collision-safe with database lock + retry.

## Fiscal year behavior
- Fiscal year is tenant-aware and company-overridable.
- Posting validations require active fiscal year and open period.
- Numbering series can reference fiscal year token from company fiscal calendar.
- Period close creates lock boundaries for accounting and stock posting dates.

## Compatibility notes
- Existing schema currently treats `Company` as tenant boundary in many paths.
- Migration path preserves current behavior while introducing explicit `Tenant` + `tenantId` fields and compatibility fallbacks.
