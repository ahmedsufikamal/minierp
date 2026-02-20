# 03 Data Model (AS-IS)

Source: `prisma/schema.prisma`

## Size snapshot
- Models: `194`
- Enums: `109`

## Core identity and tenancy entities
- `User`
- `Tenant`, `TenantDomain`
- `Company`, `CompanyMembership`, `TenantMembership`
- IAM RBAC/session entities:
  - `IamPermission`, `IamRole`, `IamRolePermission`
  - `IamSession`, `IamInvitation`, `IamAutoJoinRule`
  - `IamMfaFactor`, `IamRecoveryCode`, `IamOtpChallenge`, `IamMagicLinkToken`, `IamOAuthAccount`
  - `IamAuditLog`, `IamLoginAttempt`, `IamImpersonationSession`

## Platform primitives (ERP meta layer)
- Workflow/meta/audit/numbering/reporting/customization:
  - `WorkflowDefinition`, `WorkflowState`, `WorkflowTransition`, `WorkflowInstance`, `WorkflowAction`
  - `AuditEvent`, `ImmutableLedgerEvent`, `OutboxEvent`
  - `NumberSeries`, `NumberSeriesCounter`
  - `ReportDefinition`, `ReportView`, `ReportSchedule`
  - `CustomField`, `FormLayout`, `FormLayoutVersion`, `PropertyOverrideRule`, `ValidationRule`, `PrintTemplate`
  - `AutomationRule`, `AutomationRuleRun`

## Business domain entity groups (examples)
- Selling/AR:
  - `Customer`, `SalesInvoice`, `SalesOrder`, `DeliveryNote`, `DunningNotice`, `ReceivableAgingSnapshot`
- Buying/AP:
  - `Vendor`, `PurchaseOrder`, `PurchaseReceipt`, `PurchaseBill`, `SupplierPayment`, `PayableAgingSnapshot`
- Inventory/stock:
  - `Product`, `InventoryDocument`, `InventoryDocumentLine`, `InventoryLedgerEntry`, `InventoryStockBalance`, `InventoryReservation`, `InventoryBatch`, `InventorySerial`, `InventoryReorderRule`
- Accounting:
  - `Account`, `JournalEntry`, `JournalLine`, `GLEntry`, `FiscalYear`, `AccountingPeriod`, `PaymentEntry`
- Projects/quality/support/hr/payroll/pos/etc.:
  - `Project`, `ProjectTask`, `Timesheet`, `ProjectBillingEntry`
  - `QualityInspection`, `QualityCapa`, `QualityGoal`
  - `SupportQueue`, `SlaPolicy`, `Ticket`, `KnowledgeArticle`
  - `Employee`, `LeaveApplication`, `Attendance`, `PayrollEntry`, `Payslip`
  - `PosProfile`, `PosShift`, `PosSale`

## Multi-tenant data shape observations
- Most platform/ERP models include `companyId` and many also include `tenantId`.
- Some legacy models are company-scoped (`companyId` only) with compatibility fallbacks in app logic.
- Unique constraints are frequently namespaced by company/tenant (for example, number series and domain master data).

## Migration status context (from runtime evidence)
- Pending local migrations detected:
  - `20260226000000_user_theme_preference`
  - `20260227000000_phase3_accounting_financial_baseline`
