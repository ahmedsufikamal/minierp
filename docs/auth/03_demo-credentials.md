# IAM Demo Credentials (Env-Gated)

## Enablement
Demo users are created only when:
1. `IAM_DEMO_USERS_ENABLED=1`
2. `NODE_ENV != production`
3. `IAM_DEMO_PASSWORD` is set

## Default emails
1. Level 9: `level9.super@demo.local`
2. Level 5: `level5.master@demo.local`
3. Level 4: `level4.admin@demo.local`
4. Level 3: `level3.general@demo.local`
5. Level 2: `level2.support@demo.local`

All five users use `IAM_DEMO_PASSWORD`.

## Validation matrix
1. Level 9: global bypass across companies.
2. Level 5: full access in org scope.
3. Level 4: can manage level 3/2 members; not level 5.
4. Level 3: module-permission based; no management actions.
5. Level 2: support-oriented, limited actions.

## Seed behavior
1. Users are upserted idempotently.
2. Memberships are provisioned for both seeded companies for tenancy verification.

