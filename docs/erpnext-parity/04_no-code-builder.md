# No-Code Builder Specification

## Objectives
- Allow tenant/company admins to customize standard entities without code deployment.
- Keep runtime safe, auditable, and permission-scoped.

## Metadata model

### `CustomField`
- Scope: tenant + optional company override.
- Target: standard entity key (for example `sales_invoice`, `inventory_document`).
- Attributes:
  - `fieldKey`, `label`, `type`, `required`, `unique`, `defaultValue`
  - display flags (`showInList`, `isHidden`, `readOnly`)
  - options (`selectOptions`, link target)
  - permissions and visibility expression

Supported field types (phase baseline):
- `text`, `number`, `date`, `select`, `link`, `table`, `boolean`, `currency`, `json`

### `FormLayout`
- Layout graph for entity forms:
  - sections -> columns -> field references
  - ordering and conditional display rules

### `ValidationRule`
- Rule types:
  - required
  - min/max
  - regex
  - expression-based check
- Trigger points:
  - draft save
  - submit

### `WorkflowDefinition` assignment
- Entity type can attach to a workflow definition version.
- Runtime uses assigned workflow for state transitions.

### `PrintTemplate`
- HTML template + variable bindings.
- Template scope by tenant/company/entity.
- PDF render hook interface for export.

### `AutomationRule`
- Trigger events:
  - `on_create`
  - `on_submit`
  - `on_status_change`
- Conditions:
  - filter expression over entity payload.
- Actions (safe baseline):
  - create task
  - set field value
  - enqueue notification
  - call whitelisted webhook endpoint

## Runtime resolution rules
1. Resolve tenant metadata first.
2. Apply company override if present.
3. Apply role/permission visibility constraints.
4. Validate payload with base schema + metadata rules.
5. Persist metadata-backed values in structured JSON or typed columns.
6. Emit audit and outbox events for metadata changes and automation execution.

## Security model
- Only users with customization permissions can publish metadata.
- Metadata publish validates schema consistency and blocked unsafe expressions.
- Automation execution is sandboxed:
  - no arbitrary code execution
  - no unrestricted network access
  - execution timeout and retry limits
- Every publish and automation action is audit logged.

## Versioning and rollback
- Metadata objects are versioned.
- Publish action creates immutable version snapshot.
- Rollback re-points active version and emits audit event.

## API surface (planned)
- `GET/POST /api/v1/platform/customization/custom-fields`
- `GET/POST /api/v1/platform/customization/form-layouts`
- `GET/POST /api/v1/platform/customization/validation-rules`
- `GET/POST /api/v1/platform/customization/print-templates`
- `GET/POST /api/v1/platform/customization/automation-rules`

## Acceptance criteria
1. Custom field appears on target form and persists correctly.
2. Visibility and editability follow role/scope rules.
3. Validation rules block invalid submit.
4. Workflow assignment controls valid transitions.
5. Print template renders with entity data and export hook.
6. Automation triggers execute idempotently and are fully audited.
