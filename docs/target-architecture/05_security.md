# 05 Security

## Authentication
- Rust API validates OIDC JWTs using issuer discovery + JWKS.
- During migration, tokens are issued/exchanged by internal IAM bridge.
- Session UX remains unchanged in frontend during cutover.

## Authorization
- RBAC enforced per doctype/module action:
  - `read`, `create`, `write`, `delete`, `submit`, `cancel`.
- Tenant and company membership checks are mandatory before business logic.
- Deny by default when scope context is missing or mismatched.

## Transport and request security
- Secure headers enabled at edge/app layer.
- Rate limiting on auth-sensitive and mutation-heavy routes.
- CSRF protections required when cookie-based flows are used.
- Request IDs propagated for traceability.

## Audit and forensics
- Append-only audit events for all critical mutations.
- Include actor, tenant/company scope, entity, action, and request ID.
- Keep sensitive details out of client-facing error payloads.

## Threat model priorities
- Cross-tenant data leakage.
- Privilege escalation through role misconfiguration.
- Token misuse and stale key validation.
- Unsafe report/query execution without parameterization.
