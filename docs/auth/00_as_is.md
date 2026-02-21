# miniERP IAM AS-IS (2026-02-21)

## Runtime auth flow
1. Next.js middleware/proxy (`src/proxy.ts`) checks cookies and guards protected routes.
2. Primary auth cookie is `iam_session` validated by IAM provider (`src/modules/iam/infrastructure/session.ts`).
3. Principal resolution uses `resolvePrincipalFromTokens`/`resolvePrincipalFromCookies`.
4. Tenant context is derived from:
   - active org cookie `iam_active_org`
   - optional host/domain mapping
   - active membership in `CompanyMembership`

## Authorization model
1. Global: `User.platformRole` (`SUPER_ADMIN | SUPPORT | NONE`).
2. Org: `CompanyMembership.role` + optional `roleId`.
3. Permissions: `IamRolePermission` -> `IamPermission.key`.
4. Guards mostly call `requirePermission(permissionKey)`.

## Current data model
1. Users: `User`.
2. Tenants/companies: `Tenant`, `Company`.
3. Memberships: `CompanyMembership`, `TenantMembership`.
4. Role/permission catalog: `IamRole`, `IamPermission`, `IamRolePermission`.

## Current issues found
1. No numeric privilege level in memberships.
2. Legacy session fallback paths still present in resolver/session bridge.
3. No user-specific permission override per membership.
4. Level governance rules (who can manage whom) are not centrally enforced.
5. Rust proxied APIs did not receive a normalized user level header.

