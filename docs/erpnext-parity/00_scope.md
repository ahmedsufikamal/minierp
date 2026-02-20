# miniERP ERPNext Parity Scope Matrix

Status legend:
- `[ ] Not Started`
- `[-] In Progress`
- `[x] Done`

Compliance note:
- ERPNext and Frappe references are used for behavior-level parity only.
- Direct source reuse is prohibited in this repository due to GPLv3 and ERPNext trademark constraints.

| ERPNext Module | ERPNext Feature | Source Link | miniERP Equivalent | Status | Notes |
|---|---|---|---|---|---|
| Accounting | Chart of Accounts tree | https://docs.frappe.io/erpnext/user/manual/en/chart-of-accounts | `accounting.coa` (`Account` + hierarchy extension) | `[-] In Progress` | Account hierarchy + root type baseline landed |
| Accounting | Journal Entry | https://docs.frappe.io/erpnext/user/manual/en/accounts/journal-entry | `accounting.journal-entry` (`JournalEntry`,`JournalLine`) | `[-] In Progress` | Balanced submit/post baseline landed |
| Accounting | General Ledger | https://docs.frappe.io/erpnext/user/manual/en/accounts/general-ledger | `accounting.gl` (`GLEntry`) | `[-] In Progress` | Append-only GL posting landed for journal entries |
| Accounting | Payment Entry | https://docs.frappe.io/erpnext/user/manual/en/accounts/payment-entry | `accounting.payment-entry` (`Payment`) | `[ ] Not Started` | Allocation and reconciliation pending |
| Accounting | Fiscal Year and Period Closing | https://docs.frappe.io/erpnext/user/manual/en/accounts/fiscal-year | `accounting.period-close` | `[-] In Progress` | Fiscal year/period models and close validation landed |
| Accounting | Trial Balance report | https://docs.frappe.io/erpnext/user/manual/en/accounts/trial-balance | `reports.trial-balance` | `[-] In Progress` | Adapter-backed report endpoint landed |
| Accounting | Profit and Loss report | https://docs.frappe.io/erpnext/user/manual/en/accounts/profit-and-loss-statement | `reports.pnl` | `[-] In Progress` | Adapter-backed report endpoint landed |
| Accounting | Balance Sheet report | https://docs.frappe.io/erpnext/user/manual/en/accounts/balance-sheet | `reports.balance-sheet` | `[-] In Progress` | Adapter-backed report endpoint landed |
| Accounting | Multi-currency | https://docs.frappe.io/erpnext/user/manual/en/accounts/multi-currency-accounting | `accounting.currency` | `[ ] Not Started` | Phase 3 depth |
| Accounting | Cost center and dimensions | https://docs.frappe.io/erpnext/user/manual/en/accounts/cost-center | `accounting.dimensions` | `[ ] Not Started` | Scope rules tie-in |
| Buying | Supplier master | https://docs.frappe.io/erpnext/user/manual/en/buying/supplier | `buying.suppliers` (`Vendor`) | `[-] In Progress` | Basic vendor exists |
| Buying | Material Request | https://docs.frappe.io/erpnext/user/manual/en/stock/material-request | `buying.material-request` | `[ ] Not Started` | New doctype required |
| Buying | Request for Quotation | https://docs.frappe.io/erpnext/user/manual/en/buying/request-for-quotation | `buying.rfq` | `[ ] Not Started` | Workflow and supplier portal optional |
| Buying | Supplier Quotation | https://docs.frappe.io/erpnext/user/manual/en/buying/supplier-quotation | `buying.supplier-quotation` | `[ ] Not Started` | Comparison view required |
| Buying | Purchase Order | https://docs.frappe.io/erpnext/user/manual/en/buying/purchase-order | `buying.purchase-order` (`PurchaseOrder`) | `[-] In Progress` | Lifecycle expansion pending |
| Buying | Purchase Receipt | https://docs.frappe.io/erpnext/user/manual/en/stock/purchase-receipt | `buying.purchase-receipt` | `[ ] Not Started` | Stock posting integration needed |
| Buying | Purchase Invoice | https://docs.frappe.io/erpnext/user/manual/en/accounts/purchase-invoice | `buying.purchase-invoice` (`PurchaseBill`) | `[-] In Progress` | Tax, valuation, workflow pending |
| Buying | Supplier payments and aging | https://docs.frappe.io/erpnext/user/manual/en/accounts/accounts-payable | `buying.ap` | `[ ] Not Started` | Aging reports pending |
| Selling | Lead to Opportunity | https://docs.frappe.io/erpnext/user/manual/en/crm/lead | `crm.leads-opportunities` | `[-] In Progress` | Opportunity exists; lead entity pending |
| Selling | Customer master | https://docs.frappe.io/erpnext/user/manual/en/selling/customer | `selling.customers` (`Customer`) | `[-] In Progress` | Additional credit controls pending |
| Selling | Quotation | https://docs.frappe.io/erpnext/user/manual/en/selling/quotation | `selling.quotation` (`Quote`) | `[-] In Progress` | Terms, taxes, statuses pending |
| Selling | Sales Order | https://docs.frappe.io/erpnext/user/manual/en/selling/sales-order | `selling.sales-order` | `[ ] Not Started` | New workflow required |
| Selling | Delivery Note | https://docs.frappe.io/erpnext/user/manual/en/stock/delivery-note | `selling.delivery-note` | `[ ] Not Started` | Stock + billing linkage pending |
| Selling | Sales Invoice | https://docs.frappe.io/erpnext/user/manual/en/accounts/sales-invoice | `selling.sales-invoice` (`SalesInvoice`) | `[-] In Progress` | Taxes, posting, payment status pending |
| Selling | Dunning and receivables | https://docs.frappe.io/erpnext/user/manual/en/accounts/accounts-receivable | `selling.ar` | `[ ] Not Started` | Reminder and aging required |
| CRM | Lead management | https://docs.frappe.io/erpnext/user/manual/en/crm/lead | `crm.leads` | `[ ] Not Started` | `Opportunity` exists; `Lead` model missing |
| CRM | Opportunity pipeline | https://docs.frappe.io/erpnext/user/manual/en/crm/opportunity | `crm.pipeline` (`Opportunity`) | `[-] In Progress` | Kanban/pipeline UI pending |
| CRM | Contact and activity timeline | https://docs.frappe.io/erpnext/user/manual/en/crm/contact | `crm.contacts-activities` (`Contact`,`Activity`) | `[-] In Progress` | Unified timeline needed |
| CRM | Campaign and email integration hooks | https://docs.frappe.io/erpnext/user/manual/en/crm/campaign | `crm.campaigns-email-hooks` | `[ ] Not Started` | Integration epic |
| Stock | Item master + variants | https://docs.frappe.io/erpnext/user/manual/en/stock/item | `stock.items` (`Product` + identifiers) | `[-] In Progress` | Variants/attributes pending |
| Stock | Item Group and UOM | https://docs.frappe.io/erpnext/user/manual/en/stock/item-group | `stock.item-group-uom` | `[ ] Not Started` | Category exists; full parity pending |
| Stock | Warehouse and nested locations | https://docs.frappe.io/erpnext/user/manual/en/stock/warehouse | `stock.warehouse` (`InventoryWarehouse`,`InventoryWarehouseLocation`) | `[x] Done` | Extend branch/company scopes |
| Stock | Stock Entry workflows | https://docs.frappe.io/erpnext/user/manual/en/stock/stock-entry | `stock.documents` (`InventoryDocument`) | `[-] In Progress` | Generic workflow engine migration pending |
| Stock | Stock Ledger | https://docs.frappe.io/erpnext/user/manual/en/stock/stock-ledger | `stock.ledger` (`InventoryLedgerEntry`) | `[-] In Progress` | Immutable hooks expanded for posting/reconciliation/reservations |
| Stock | Stock Reconciliation | https://docs.frappe.io/erpnext/user/manual/en/stock/stock-reconciliation | `stock.reconciliation` | `[-] In Progress` | COUNT-backed preview/apply baseline landed |
| Stock | Serial and Batch | https://docs.frappe.io/erpnext/user/manual/en/stock/serial-no | `stock.serial-batch` | `[-] In Progress` | Serial/batch registry + posting baseline landed |
| Stock | Reorder and auto procurement | https://docs.frappe.io/erpnext/user/manual/en/stock/item-reorder | `stock.reorder` (`InventoryReorderRule`) | `[-] In Progress` | Auto PO generation pending |
| Manufacturing | BOM | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/bill-of-materials | `mfg.bom` | `[ ] Not Started` | Core entities planned |
| Manufacturing | Work Order | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/work-order | `mfg.work-order` | `[ ] Not Started` | Capacity checks pending |
| Manufacturing | Job Card and operations | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/job-card | `mfg.job-card` | `[ ] Not Started` | Workstation models pending |
| Manufacturing | Routing and workstation | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/routing | `mfg.routing` | `[ ] Not Started` | Phase 3 |
| Manufacturing | Subcontracting | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/subcontracting | `mfg.subcontracting` | `[ ] Not Started` | Supplier-managed stock required |
| Projects | Project | https://docs.frappe.io/erpnext/user/manual/en/projects/project | `projects.project` | `[ ] Not Started` | Model pending |
| Projects | Task | https://docs.frappe.io/erpnext/user/manual/en/projects/task | `projects.task` (`Task` currently CRM-scoped) | `[-] In Progress` | Needs project scoping |
| Projects | Timesheet | https://docs.frappe.io/erpnext/user/manual/en/projects/timesheet | `projects.timesheet` | `[ ] Not Started` | Billing linkage pending |
| Projects | Project billing | https://docs.frappe.io/erpnext/user/manual/en/projects/project-billing | `projects.billing` | `[ ] Not Started` | Sales integration pending |
| Assets | Asset master | https://docs.frappe.io/erpnext/user/manual/en/asset/asset | `assets.asset` | `[ ] Not Started` | Entity pending |
| Assets | Asset category and depreciation | https://docs.frappe.io/erpnext/user/manual/en/asset/asset-category | `assets.depreciation` | `[ ] Not Started` | Schedule engine pending |
| Assets | Asset movement and disposal | https://docs.frappe.io/erpnext/user/manual/en/asset/asset-movement | `assets.lifecycle` | `[ ] Not Started` | Accounting posting needed |
| POS | POS profile | https://docs.frappe.io/erpnext/user/manual/en/point-of-sale/pos-profile | `pos.profile` | `[ ] Not Started` | POS settings pending |
| POS | POS invoice and offline basics | https://docs.frappe.io/erpnext/user/manual/en/point-of-sale/point-of-sale | `pos.checkout` | `[ ] Not Started` | MVP online first |
| POS | POS payments and shift closing | https://docs.frappe.io/erpnext/user/manual/en/point-of-sale/closing-entry | `pos.closing-entry` | `[ ] Not Started` | Cash reconciliation pending |
| Quality | Quality Inspection | https://docs.frappe.io/erpnext/user/manual/en/quality-management/quality-inspection | `quality.inspection` | `[ ] Not Started` | Link to receipt/production |
| Quality | Quality Goal and feedback | https://docs.frappe.io/erpnext/user/manual/en/quality-management/quality-goal | `quality.goals` | `[ ] Not Started` | KPIs pending |
| Quality | Non-conformance / corrective actions | https://docs.frappe.io/erpnext/user/manual/en/quality-management/quality-action | `quality.capa` | `[ ] Not Started` | Workflow dependency |
| Support | Issue/Ticket | https://docs.frappe.io/erpnext/user/manual/en/support/issue | `support.ticket` | `[ ] Not Started` | SLA workflow required |
| Support | SLA policies | https://docs.frappe.io/erpnext/user/manual/en/support/service-level-agreement | `support.sla` | `[ ] Not Started` | Timer/escalation jobs needed |
| Support | Assignment and queues | https://docs.frappe.io/erpnext/user/manual/en/support/assignment-rule | `support.assignment` | `[ ] Not Started` | Role scope integration |
| Support | Knowledge base | https://docs.frappe.io/erpnext/user/manual/en/support/knowledge-base | `support.knowledge-base` | `[ ] Not Started` | Phase 3 |
| HR & Payroll | Employee master | https://docs.frappe.io/erpnext/user/manual/en/human-resources/employee | `hr.employee` | `[ ] Not Started` | Core HR model pending |
| HR & Payroll | Leave allocation/application | https://docs.frappe.io/erpnext/user/manual/en/human-resources/leave-allocation | `hr.leave` | `[ ] Not Started` | Approval workflow needed |
| HR & Payroll | Attendance | https://docs.frappe.io/erpnext/user/manual/en/human-resources/attendance | `hr.attendance` | `[ ] Not Started` | Device integration optional |
| HR & Payroll | Salary structure | https://docs.frappe.io/erpnext/user/manual/en/human-resources/salary-structure | `payroll.salary-structure` | `[ ] Not Started` | Components and formulas |
| HR & Payroll | Payroll entry + payslip | https://docs.frappe.io/erpnext/user/manual/en/human-resources/payroll-entry | `payroll.payslip` | `[ ] Not Started` | MVP stub then statutory depth |
| HR & Payroll | Expense claims | https://docs.frappe.io/erpnext/user/manual/en/human-resources/expense-claim | `hr.expense-claim` | `[ ] Not Started` | Accounts payable link |
| Customization / No-code | Custom fields on standard entities | https://docs.frappe.io/erpnext/user/manual/en/customize-erpnext/custom-field | `platform.custom-fields` | `[-] In Progress` | Inventory-only exists today |
| Customization / No-code | Form layout builder | https://docs.frappe.io/erpnext/user/manual/en/customize-erpnext/customize-form | `platform.form-layout` | `[ ] Not Started` | Cross-module metadata pending |
| Customization / No-code | Property setter style behavior overrides | https://docs.frappe.io/erpnext/user/manual/en/customize-erpnext/property-setter | `platform.field-rules` | `[ ] Not Started` | Rule evaluator pending |
| Customization / No-code | Workflow builder | https://docs.frappe.io/erpnext/user/manual/en/setting-up/workflows | `platform.workflow` | `[-] In Progress` | Inventory workflow exists; generic pending |
| Customization / No-code | Print format templates | https://docs.frappe.io/erpnext/user/manual/en/setting-up/print/print-format | `platform.print-templates` | `[-] In Progress` | Inventory labels exist |
| Customization / No-code | Automation rules | https://docs.frappe.io/erpnext/user/manual/en/setting-up/automation | `platform.automation` | `[ ] Not Started` | Sandboxed actions pending |
| Integrations | Email queue and templates | https://docs.frappe.io/erpnext/user/manual/en/setting-up/email/email-account | `integrations.email` | `[ ] Not Started` | Current IAM notifications partial |
| Integrations | Webhooks | https://docs.frappe.io/erpnext/user/manual/en/automation/webhook | `integrations.webhooks` | `[-] In Progress` | Inventory webhook subscription exists |
| Integrations | REST API tokens | https://docs.frappe.io/erpnext/user/manual/en/setting-up/integrations/rest-api | `integrations.api-tokens` | `[-] In Progress` | API key auth exists; expand scopes |
| Integrations | Data import/export tool | https://docs.frappe.io/erpnext/user/manual/en/data/data-import | `integrations.import-export` | `[-] In Progress` | Inventory import/export exists |
| Integrations | Background jobs / scheduler | https://docs.frappe.io/framework/user/en/basics/architecture | `platform.jobs` | `[-] In Progress` | BullMQ/inline exists |
| Platform | Multi-tenancy architecture | https://docs.frappe.io/framework/user/en/bench/guides/setup-multitenancy | `platform.tenancy` (`Tenant`,`TenantDomain`) | `[-] In Progress` | Company currently tenant boundary |
| Platform | Role-based permissions | https://docs.frappe.io/erpnext/user/manual/en/setting-up/users-and-permissions/role-based-permissions | `platform.rbac` (`RoleProfile`,`PermissionRule`) | `[-] In Progress` | Scope-level rules pending |
| Platform | Audit trail | https://docs.frappe.io/erpnext/user/manual/en/using-erpnext/audit-trail | `platform.audit` (`AuditEvent`) | `[-] In Progress` | Unified event model pending |
| Platform | Numbering series | https://docs.frappe.io/erpnext/user/manual/en/setting-up/settings/naming-series | `platform.number-series` | `[-] In Progress` | Allocator landed; module rollout in progress |
| Platform | Script reports and query reports | https://docs.frappe.io/erpnext/user/manual/en/desk/reports/query-report | `platform.reporting` | `[-] In Progress` | Safe adapter report layer landed |

## Module completion rule
A module may only be marked `[x] Done` when:
1. All mandatory feature rows in this file are `[x] Done`.
2. Module acceptance tests in `docs/erpnext-parity/03_modules.md` pass.
3. RBAC, row-scope, workflow, and audit checks pass for module endpoints.
