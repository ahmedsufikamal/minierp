# miniERP IAM TO-BE (Level-First)

## Primary model
1. Membership-level numeric control is first-class:
   - `9 SUPER_USER`
   - `5 MASTER_USER`
   - `4 ADMINISTRATOR_USER`
   - `3 GENERAL_USER`
   - `2 SUPPORT_USER`
2. Existing role/permission tables stay for compatibility and module-level access.

## Policy precedence
1. `SUPER_USER` bypass across tenants.
2. `MASTER_USER` full access in own org.
3. `ADMINISTRATOR_USER` org admin scope (manage level 3/2 users).
4. `GENERAL_USER` and `SUPPORT_USER` must satisfy:
   - level policy **and**
   - explicit module permission.

## Standard actions
1. `read`
2. `create`
3. `update`
4. `delete`
5. `submit_approve`
6. `export`
7. `manage`

## Governance rules
1. Level 5 can manage levels 4/3/2 in same org.
2. Level 4 can manage levels 3/2 in same org.
3. Level 3/2 cannot manage identities/roles.

## Tenant isolation
1. Every org API checks `principal.activeCompanyId === route companyId`.
2. Every scoped query keeps `companyId` in where clause.
3. Rust API receives trusted proxy headers including company, tenant, user, permissions, and user level.

