# miniERP Migration Plan (MVP -> ERPNext Parity)

## Delivery model
- Owner for all tasks: `Codex`
- Cadence: small, reviewable PR-sized changes.
- Rule: every milestone updates parity matrix and test evidence.

## Milestones
- `M0` Week 1: parity docs + architecture baseline + guardrails verified.
- `M1` Weeks 2-3: tenancy/company hierarchy and context resolution.
- `M2` Weeks 4-5: RBAC scope model + row-level enforcement.
- `M3` Weeks 6-7: generic workflow engine + inventory adapter.
- `M4` Weeks 8-9: unified audit + immutable ledger + outbox.
- `M5` Weeks 10-11: numbering + reporting + customization foundation.
- `M6` Week 12: hardening, performance, and phase-1 completion gate.

## Executable backlog

| Epic | Task | Owner | Depends On | Timebox | Acceptance tests |
|---|---|---|---|---|---|
| E0 | Create `docs/erpnext-parity/00..05` initial versions | Codex | None | 2d | Files exist, links valid, scope coverage complete |
| E0 | Document current stack and CI/test baseline in architecture doc | Codex | E0 | 0.5d | Architecture doc references real repo artifacts |
| E1 | Add `Tenant` + `TenantDomain` schema + migration | Codex | E0 | 2d | Migration applies; tenant has >=2 companies |
| E1 | Add compatibility backfill for existing company records | Codex | E1 | 1d | Existing company data still accessible |
| E1 | Add tenant resolver service (host + session + fallback) | Codex | E1 | 1d | Deterministic tenant context in API |
| E1 | Add middleware hook for domain mapping | Codex | E1 | 1d | Branded host resolves tenant correctly |
| E2 | Introduce `RoleProfile`, `PermissionRule`, `RowScopeRule` models | Codex | E1 | 2d | CRUD + validation paths available |
| E2 | Implement `AuthorizationService` and `RowScopeService` | Codex | E2 | 2d | Scope checks enforce tenant/company/warehouse/project |
| E2 | Integrate scope evaluator into selected module query paths | Codex | E2 | 1d | Negative isolation tests pass |
| E3 | Add generic workflow schema (`Workflow*`) and services | Codex | E2 | 2d | Definition + transition + approval APIs working |
| E3 | Adapt inventory workflows through platform adapter | Codex | E3 | 2d | Inventory transitions executed via generic engine |
| E4 | Add `AuditEvent`, `ImmutableLedgerEvent`, `OutboxEvent` models | Codex | E2 | 2d | Append-only writes + read APIs available |
| E4 | Implement hash-chain verification and tamper detection | Codex | E4 | 1d | Verification job/API flags tampering |
| E4 | Wire inventory/accounting critical actions to ledger events | Codex | E4 | 2d | Posting actions emit immutable events |
| E5 | Implement numbering series models and allocator service | Codex | E1 | 2d | Concurrent allocation uniqueness tests pass |
| E5 | Add fiscal reset rules and preview API | Codex | E5 | 1d | FY boundary reset behavior verified |
| E6 | Implement report definitions/views/schedules models | Codex | E2 | 2d | Saved report CRUD works |
| E6 | Implement safe report query adapters + export hook | Codex | E6 | 2d | Unsafe query inputs rejected |
| E7 | Implement no-code metadata primitives (`CustomField`,`FormLayout`,`ValidationRule`,`PrintTemplate`,`AutomationRule`) | Codex | E2 | 3d | Metadata persists and validates |
| E7 | Add runtime resolution service for metadata overlays | Codex | E7 | 2d | Entity forms/read models apply metadata |
| E8 | Expand seed fixtures to 1 tenant + 2 companies + role profiles + demo transactions | Codex | E1,E2,E5 | 2d | Deterministic fixtures used by tests |
| E8 | Phase 1 verification suite (unit/integration/e2e/security checks) | Codex | E2-E8 | 3d | Required Phase 1 tests pass |

## Phase 0 guardrails checklist
- [x] Lint/test/format scripts documented and verified.
- [x] Unit, integration, e2e scaffolding documented and runnable.
- [x] Seed data includes tenant + two companies and role profiles.
- [x] CI mapping documented in architecture doc.

## Phase 1 done checklist
- [x] Tenancy and domain resolver in place.
- [x] RBAC and row-scope engine implemented.
- [x] Generic workflow engine available and inventory adapter landed.
- [x] Unified audit and immutable ledger events live.
- [x] Numbering series service live.
- [x] Reporting engine baseline live.

## Phase 2 wave status
- [x] Wave 0 closeout (platform verification + docs sync)
- [-] Wave 1 accounting MVP (schema/services/APIs/minimal routes/tests)
- [-] Wave 2 stock MVP completion alignment
- [ ] Wave 3 sales chain MVP
- [ ] Wave 4 procurement chain MVP
- [ ] Wave 5 CRM MVP
- [ ] Wave 6 projects MVP
- [ ] Wave 7 support MVP
- [ ] Wave 8 HR & payroll MVP
- [ ] Wave 9 assets MVP
- [ ] Wave 10 POS MVP
- [ ] Wave 11 quality MVP

## Required acceptance test pack

### Tenancy isolation
1. User can list records within own tenant.
2. Tenant admin can switch to another company within same tenant.
3. Cross-tenant read denied.
4. Cross-tenant write denied.

### RBAC and scope
1. Scoped role can execute only granted resource/action.
2. Missing permission denied.
3. Warehouse/project row-scope mismatch denied.

### Workflow
1. Valid transition succeeds.
2. Multi-approver quorum transition succeeds.
3. Invalid transition denied.
4. Unauthorized approver denied.

### Immutable ledger and audit
1. Posting creates audit + immutable ledger event.
2. Audit timeline query works by entity.
3. Mutation/delete of immutable event denied.
4. Hash-chain tamper verification fails on modified chain.

### Numbering
1. Pattern generation with FY/company tokens succeeds.
2. Fiscal-year reset works.
3. Concurrent allocation remains unique.
4. Invalid token config rejected.

### Reporting
1. Saved report with filters returns paginated result.
2. Export honors filters.
3. Unsafe/unsupported query rejected.
4. Unauthorized report access denied.

## Risks and mitigations
- Large schema migration risk:
  - Use additive migrations + backfill + compatibility bridge.
- Auth drift risk:
  - Central policy service with integration tests on all new routes.
- Performance regression risk:
  - Index-first migrations and pagination constraints.
- Legal risk:
  - Keep behavior-only references and avoid direct source reuse.
