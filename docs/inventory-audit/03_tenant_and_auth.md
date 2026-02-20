# Inventory Tenant and Auth Enforcement (AS-IS)

## Request authentication path (inventory APIs)
1. Route handlers call `withInventoryAuth(request, permission, handler)`.
2. `withInventoryAuth` resolves context via `getInventoryRequestContext(request)`.
3. Context resolution (`src/modules/inventory/interface/context.ts`):
   - API key auth path (`authenticateApiKeyRequest`) or
   - IAM/legacy cookie path (`resolvePrincipalFromTokens`).
4. If unauthenticated, returns `UNAUTHORIZED` JSON envelope.

## Company/tenant derivation
- Primary context is `principal.activeCompanyId`.
- Optional company switch header: `x-company-id`.
- If `x-company-id` differs from active company, membership is validated using `companyMembership` lookup (`ACTIVE` required).
- `tenantId` is resolved from `company.tenantId` when available; falls back to company id on schema-mismatch fallback.

## Permission enforcement
- Required permission constants are defined in `inventoryPermissions`.
- `withInventoryAuth` supports:
  - IAM permission list checks when `IAM_INVENTORY_PERMISSION_SYNC_ENABLED` and session permissions are present.
  - Legacy role mapping fallback through `assertInventoryPermission`.

## Data-layer scoping pattern
- Inventory services generally scope queries by `companyId: ctx.companyId`.
- Most list/read/create paths are company-scoped.
- High-risk update/delete paths were hardened in this pass to enforce scoped writes with company predicates (`updateMany/deleteMany` + scoped re-read) in:
  - `src/modules/inventory/application/items.service.ts`
  - `src/modules/inventory/application/warehouses.service.ts`
  - `src/modules/inventory/application/reorder.service.ts`
  - `src/modules/inventory/application/custom-fields.service.ts`
  - `src/modules/inventory/application/attachments.service.ts`
  - `src/modules/inventory/application/view-presets.service.ts`
  - `src/modules/inventory/application/label-templates.service.ts`

## Risks identified
1. Remaining audit advisories:
   - `tenancy-scope-audit` still reports advisory findings (including list/count calls and non-inventory modules).
   - Inventory mutation hardening is improved, but the static scanner remains conservative.
2. Mixed auth paths:
   - API key and cookie paths coexist; behavior is compatible but needs strict parity testing for company switch and permission edge cases.
3. No DB-level RLS currently:
   - Isolation relies on application-layer discipline.

## Current probe evidence
- Unauthenticated inventory API requests return `401` with inventory error envelope.
- Logs: `docs/inventory-audit/logs/23_dev_api_items.log`, `24_dev_api_warehouses.log`, `25_dev_api_ledger.log`.
- Cross-company negative-path integration coverage:
  - `src/modules/inventory/application/__tests__/tenant-isolation.integration.test.ts`
- Static audit after hardening:
  - `docs/inventory-audit/logs/34_tenancy_audit_after_fix.log`
