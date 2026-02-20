# Remaining Work Snapshot (2026-02-20)

Current parity matrix (`docs/erpnext-parity/00_scope.md`):

- Rows: `92`
- Done: `3`
- In Progress: `89`
- Not Started: `0`

## Not started rows (must implement)

1. None. All previously not-started rows were moved to `[-] In Progress` in this pass.

## In-progress closure blockers

1. Replace remaining legacy-wrapped module pages with API-first workbenches (placeholder pages now run API baseline workbench).
2. Complete TanStack Query adoption in module UIs (client/provider/query-key foundation exists; per-screen query/mutation hooks remain).
3. Complete policy-grade workflow constraints for selling/buying/manufacturing/support/payroll.
4. Expand deep report/analytics parity beyond baseline endpoints (AP/AR drilldowns, support KB analytics, project billing profitability).
5. Increase module test density to target baseline (3 happy + 2 negative + pagination/index checks).
6. Add explicit RBAC + row-scope negative-path tests per module route/API pair.
7. Close immutable/audit verification for posting-critical document chains.

## Quality gate status

- `npm run parity:status`: passes
- `npm run typecheck`: passes (`tsconfig.refactor.json`)
- `npm run lint`: passes
- `npm run test:unit`: passes
- `RUN_INTEGRATION_TESTS=1 npm run test:integration`: passes
- `npm run typecheck:full`: passes
- `npm run build`: passes

## UI/UX architecture status

1. Canonical namespaced module routes are present for Setup, Stock, Accounting, Selling, CRM, Buying, Manufacturing, Subcontracting, Quality, Projects, Support, Communication, Telephony, HR, Payroll, Assets, Maintenance, Regional, POS, Portal, Integrations, EDI, Bulk, Utilities, Platform.
2. Sidebar and command palette now resolve against canonical module route IA.
3. Legacy route redirects are configured for core legacy paths.
4. Theme modes are contract-complete in UI labels and preference storage: `Light`, `Dark`, `Automatic (System)`.
