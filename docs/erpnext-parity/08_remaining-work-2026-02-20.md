# Remaining Work Snapshot (2026-02-20)

Current parity matrix (`docs/erpnext-parity/00_scope.md`):

- Rows: `92`
- Done: `3`
- In Progress: `78`
- Not Started: `11`

## Not started rows (must implement)

1. Accounting Payment Entry (`accounting.payment-entry`)
2. Accounting Multi-currency (`accounting.currency`)
3. Accounting Cost center and dimensions (`accounting.dimensions`)
4. Buying Supplier payments and aging (`buying.ap`)
5. Selling Dunning and receivables (`selling.ar`)
6. Projects Project billing (`projects.billing`)
7. Quality Goal and feedback (`quality.goals`)
8. Support Knowledge base (`support.knowledge-base`)
9. No-code Form layout builder (`platform.form-layout`)
10. No-code Property setter overrides (`platform.field-rules`)
11. No-code Automation rules runtime (`platform.automation`)

## In-progress closure blockers

1. Replace module placeholder pages with API-first workbenches (canonical routes already scaffolded).
2. Complete TanStack Query adoption in module UIs (client/provider/query-key foundation exists; per-screen query/mutation hooks remain).
3. Complete policy-grade workflow constraints for selling/buying/manufacturing/support/payroll.
4. Complete report parity gaps: AP/AR aging, project billing, quality goals, support KB analytics.
5. Increase module test density to target baseline (3 happy + 2 negative + pagination/index checks).
6. Add explicit RBAC + row-scope negative-path tests per module route/API pair.
7. Close immutable/audit verification for posting-critical document chains.

## Quality gate status

- `npm run parity:status`: passes
- `npm run typecheck`: passes (`tsconfig.refactor.json`)
- `npm run lint`: passes
- `npm run test:unit`: passes
- `npm run typecheck:full`: passes
- `npm run build`: passes

## UI/UX architecture status

1. Canonical namespaced module routes are present for Setup, Stock, Accounting, Selling, CRM, Buying, Manufacturing, Subcontracting, Quality, Projects, Support, Communication, Telephony, HR, Payroll, Assets, Maintenance, Regional, POS, Portal, Integrations, EDI, Bulk, Utilities, Platform.
2. Sidebar and command palette now resolve against canonical module route IA.
3. Legacy route redirects are configured for core legacy paths.
4. Theme modes are contract-complete in UI labels and preference storage: `Light`, `Dark`, `Automatic (System)`.
