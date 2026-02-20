# ERPNext Source Module Map (Full Parity Baseline)

Source of truth for this map:
- `erpnext-develop/erpnext/modules.txt` from `/Users/sufi-mac-pro/Downloads/erpnext-develop.zip`
- Snapshot date: 2026-02-20

This map aligns ERPNext source modules with miniERP parity ownership and mandatory behavior slices.

| ERPNext source module | Approx doctype count | miniERP parity module key | Mandatory behavior slice for parity gate |
|---|---:|---|---|
| Accounts | 185 | Accounting | COA tree, JE posting, GL append-only, fiscal periods, core financial reports |
| CRM | 28 | CRM | Leads, opportunities, activity timeline, campaign hooks |
| Buying | 20 | Buying | Material request, RFQ, supplier quotation, PO, purchase receipt/invoice chain |
| Projects | 15 | Projects | Project/task/timesheet with billing link |
| Selling | 18 | Selling | Quotation, sales order, delivery, invoice, receivables controls |
| Setup | 40 | Setup | Item Group, UOM, territory, customer/supplier groups, branch/department/designation |
| Manufacturing | 47 | Manufacturing | BOM, routing, work order, job card, capacity checks |
| Stock | 77 | Stock | Item + variants, warehouses, stock docs, ledger, reconciliation, serial/batch, reservations |
| Support | 11 | Support | Tickets, SLA policy, assignment queues |
| Utilities | 4 | Utilities | Admin tools and utility operations baseline |
| Assets | 26 | Assets | Asset lifecycle, depreciation, disposal posting |
| Portal | 2 | Portal | Portal-facing filter/attribute configuration baseline |
| Maintenance | 5 | Maintenance | Maintenance schedules and visits |
| Regional | 5 | Regional | Regional tax/settings adapters |
| ERPNext Integrations | 1 | Integrations | External connectors baseline and secure credential handling |
| Quality Management | 16 | Quality | Inspection and CAPA baseline |
| Communication | 2 | Communication | Communication medium and schedule baseline |
| Telephony | 5 | Telephony | Call log and incoming handling baseline |
| Bulk Transaction | 2 | Bulk Transaction | Bulk operation log/execution safeguards |
| Subcontracting | 13 | Subcontracting | Subcontracting order/receipt flows |
| EDI | 2 | EDI | Code lists and transport adapter baseline |

## Ownership
- Execution owner for all modules in this parity phase: `Codex`
- Approval owner: repository maintainers reviewing parity evidence in PRs

## Gating rule
A source module is considered parity-complete only when:
1. Its mandatory behavior slice rows in `docs/erpnext-parity/00_scope.md` are all `[x] Done`.
2. Relevant acceptance tests in `docs/erpnext-parity/03_modules.md` pass.
3. RBAC, row-scope, workflow, and audit/immutable checks pass where applicable.
