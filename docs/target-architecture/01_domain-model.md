# 01 Domain Model

## Core identities
- `TenantId`: top-level SaaS tenant boundary.
- `CompanyId`: operational organization within tenant.
- `UserId`: authenticated principal.
- `RoleId`: permission bundle assignment.

## ERP primitives (minimum viable)
- DocType metadata:
  - `doctype`
  - `doctype_field`
  - `doctype_layout`
  - `doctype_validation_rule`
- Workflow:
  - `workflow_definition`
  - `workflow_state`
  - `workflow_transition`
  - `workflow_instance`
- Security:
  - `role`
  - `permission_rule` (doctype + action level)
  - `field_permission_rule` (phase 2)
- Audit:
  - `audit_event` (append-only)
- Naming:
  - `naming_series`
  - `naming_counter`
- Reporting:
  - `saved_report`
  - `report_view`
  - `report_schedule`
- Jobs:
  - `job`
  - `job_attempt`
  - `outbox_event`

## Business slices for migration order
1. Tenant/User/Org switch APIs.
2. Items.
3. Customers/Suppliers.
4. Invoices.
5. DocType metadata APIs.

## Invariants
- Every business record includes `tenant_id` and `company_id` (except global metadata explicitly marked global).
- Cross-tenant access is impossible by default; explicit membership is required for company scope.
- Workflow transitions are validated against current state and actor permissions.
- All create/update/delete/submit/cancel actions emit audit events.
