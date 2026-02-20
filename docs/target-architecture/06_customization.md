# 06 Customization

## DocType-like metadata layer (MVP)

### Data structures
- `doctype`: key, module, naming config, permissions policy refs.
- `doctype_field`: field type, label, required, defaults, options.
- `doctype_layout`: section/column layout and ordering.
- `doctype_validation_rule`: declarative validation constraints.

### Runtime behavior
- Form schemas are resolved from metadata at request/render time.
- Create/update validation uses metadata + workflow + permission checks.
- Layout metadata drives form rendering (workbench baseline first).

## Workflow integration
- Metadata links doctypes to workflow definitions.
- Allowed transitions are evaluated server-side with actor role checks.

## Permission model
- Role permission rules map doctype + action.
- Phase 2 adds field-level visibility/editability.

## Naming series
- Per-tenant/per-company naming rules for transactional docs (e.g., invoices).
- Concurrency-safe counters with idempotent write handling.

## Reports over metadata-backed entities
- Saved report definitions with parameterized filters.
- Query execution must enforce tenant/company scope automatically.

## Incremental delivery plan
1. Metadata read APIs (doctype/field/layout).
2. Metadata-backed create/validate for a pilot doctype.
3. Workflow transitions + audit events.
4. Extend to reports and additional doctypes.
