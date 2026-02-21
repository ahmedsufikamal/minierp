# IAM Migration Notes (Level-First)

## Migration ID
`20260221165000_iam_user_levels_and_membership_permissions`

## Schema changes
1. `CompanyMembership.userTypeLevel INT NOT NULL DEFAULT 3`
2. `CompanyMembership.userTypeLabel TEXT NULL`
3. Check constraint: `userTypeLevel IN (2,3,4,5,9)`
4. New table: `CompanyMembershipPermission` for user-specific overrides.
5. Indexes:
   - `(companyId, userTypeLevel, status)`
   - `(userId, companyId, status)`
6. Safety unique index:
   - one active level-5 membership per company.

## Backfill logic
1. Role map:
   - OWNER -> 5
   - ADMIN -> 4
   - SUPPORT -> 2
   - else -> 3
2. If user has `platformRole=SUPER_ADMIN`, membership level set to 9.
3. `userTypeLabel` updated from resulting level.

## Rollback guidance
1. Revert application to pre-level-aware commit.
2. Keep new columns/table intact (non-breaking rollback).
3. If strict rollback required, drop:
   - `CompanyMembershipPermission` table
   - added indexes/constraints
   - `userTypeLevel`, `userTypeLabel` columns.

