-- Backfill: ensure at most one ACTIVE OWNER (Master Admin) per company.
WITH ranked_owners AS (
  SELECT
    membership.id,
    membership."companyId",
    ROW_NUMBER() OVER (
      PARTITION BY membership."companyId"
      ORDER BY COALESCE(membership."joinedAt", membership."createdAt"), membership."createdAt", membership.id
    ) AS rn
  FROM "CompanyMembership" AS membership
  WHERE membership.role = 'OWNER'
    AND membership.status = 'ACTIVE'
)
UPDATE "CompanyMembership" AS membership
SET
  role = 'ADMIN',
  "roleId" = admin_role.id,
  "updatedAt" = NOW()
FROM ranked_owners
LEFT JOIN "IamRole" AS admin_role
  ON admin_role."orgId" = ranked_owners."companyId"
  AND admin_role.name = 'ADMIN'
WHERE membership.id = ranked_owners.id
  AND ranked_owners.rn > 1;

-- Backfill: if a company has zero ACTIVE OWNER, promote the earliest ACTIVE member.
WITH companies_without_owner AS (
  SELECT company.id
  FROM "Company" AS company
  WHERE NOT EXISTS (
    SELECT 1
    FROM "CompanyMembership" AS membership
    WHERE membership."companyId" = company.id
      AND membership.role = 'OWNER'
      AND membership.status = 'ACTIVE'
  )
),
ranked_active_members AS (
  SELECT
    membership.id,
    membership."companyId",
    ROW_NUMBER() OVER (
      PARTITION BY membership."companyId"
      ORDER BY COALESCE(membership."joinedAt", membership."createdAt"), membership."createdAt", membership.id
    ) AS rn
  FROM "CompanyMembership" AS membership
  JOIN companies_without_owner AS company
    ON company.id = membership."companyId"
  WHERE membership.status = 'ACTIVE'
)
UPDATE "CompanyMembership" AS membership
SET
  role = 'OWNER',
  "roleId" = owner_role.id,
  "updatedAt" = NOW()
FROM ranked_active_members
LEFT JOIN "IamRole" AS owner_role
  ON owner_role."orgId" = ranked_active_members."companyId"
  AND owner_role.name = 'OWNER'
WHERE membership.id = ranked_active_members.id
  AND ranked_active_members.rn = 1;

-- Enforce one ACTIVE OWNER per company at the database layer.
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembership_one_active_owner_per_company_idx"
  ON "CompanyMembership" ("companyId")
  WHERE role = 'OWNER' AND status = 'ACTIVE';
