# Module B: Metadata / Low-Code Customization

## Concepts
- `MetaModel`: model dictionary entry per tenant/company.
- `MetaFieldDef`: field definitions including base-field mapping and custom metadata.
- `MetaWorkflow*`: draft/published workflow states/transitions.
- `MetaPrintTemplate`: draft/published templates with strict variable rendering.
- `MetaPermissionPolicy` + `MetaCustomPermissionType`: model-scoped permission overlays.
- `CompiledMeta`: publish-time compiled snapshot (`validationSchema`, `uiSchema`, search and permission hints).
- `MetaChangeLog`: metadata change diff trail.

## Lifecycle
1. Metadata is edited in draft.
2. Publish action validates integrity and security constraints.
3. Service compiles and stores immutable `CompiledMeta` with incremented version.
4. `MetaModel.publishedVersion` is updated.
5. In-memory cache is invalidated for model key.

## Security Controls
- Permission gates:
- `meta.read`, `meta.read_drafts`, `meta.write`, `meta.publish`.
- Draft access is withheld unless caller has `meta.read_drafts`.
- Expression rules are JSONLogic-only with allowlisted operators.
- Template rendering is strict-token, escaped by default, no dynamic helpers.
- Optional HTML sanitization gate: `META_TEMPLATE_SANITIZE_STRICT`.
- Metadata permission ceiling enforcement prevents draft rules from requiring permissions the editor does not hold.

## Caching and ETag
- Compiled metadata cache key: `(tenantId, companyId, modelName, version)` with TTL from `META_COMPILED_CACHE_TTL_MS`.
- Compiled endpoint supports `ETag` and `If-None-Match` (`304 Not Modified`).

## Integration with Master Data
- Core metadata models for Party/Item/UoM/PriceList/Currency/TaxCode/NumberSeries/Warehouse/Location are seeded per tenant/company.
- Master entity `customData` is validated against published compiled metadata schema.
- Workflow transition checks are enforced server-side for model status moves.
