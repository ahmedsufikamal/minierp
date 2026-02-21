# IAM Fix Log

## F-01 Legacy fallback removed from runtime auth path
1. Reproduction:
   - Runtime resolver accepted `session` fallback when IAM cookie missing.
2. Root cause:
   - `allowLegacyFallback` was enabled in runtime contexts.
3. Code changes:
   - Disabled default legacy fallback in `principal-resolver` and runtime callsites.
   - Session bridge now rejects legacy bridging in hard-switch mode.
4. Verification:
   - `src/modules/iam/application/principal-resolver.ts`
   - `src/lib/session.ts`
   - `src/modules/inventory/interface/context.ts`
   - `src/modules/platform/interface/context.ts`
5. Status: fixed.

## F-02 Level-first authorization model added
1. Reproduction:
   - No numeric privilege layer; only role name and permission keys.
2. Root cause:
   - `CompanyMembership` lacked level metadata and guard layer.
3. Code changes:
   - Added `userTypeLevel`/`userTypeLabel` to memberships.
   - Added `level-policy` helper and wired guard enforcement.
4. Verification:
   - `src/modules/iam/application/level-policy.ts`
   - `src/modules/iam/application/guards.ts`
   - `src/modules/iam/application/__tests__/level-policy.test.ts`
5. Status: fixed.

## F-03 Missing per-user permission override path for level-3 users
1. Reproduction:
   - Could only assign permissions through shared roles.
2. Root cause:
   - No membership-level permission table or API.
3. Code changes:
   - Added `CompanyMembershipPermission` model + migration.
   - Added org member permissions endpoint.
4. Verification:
   - `prisma/schema.prisma`
   - `prisma/migrations/20260221165000_iam_user_levels_and_membership_permissions/migration.sql`
   - `src/app/api/orgs/[id]/members/[userId]/permissions/route.ts`
5. Status: fixed.

## F-04 Member management missing level governance
1. Reproduction:
   - Member updates/removals validated role semantics but not actor-vs-target level.
2. Root cause:
   - No central level manage checks in member routes/actions.
3. Code changes:
   - Added actor-target level checks in API and server actions.
   - Added level display/edit controls in Org Members UI.
4. Verification:
   - `src/app/api/orgs/[id]/members/route.ts`
   - `src/app/(app)/org/actions.ts`
   - `src/app/(app)/org/members/page.tsx`
5. Status: fixed.

## F-05 Rust auth header parity missing user-level signal
1. Reproduction:
   - Rust endpoints received role and permissions but not normalized level.
2. Root cause:
   - Proxy/header contract lacked `x-minierp-user-level`.
3. Code changes:
   - Added header forwarding in inventory proxies.
   - Added Rust parsing + level-aware stock-settings write gate behavior.
4. Verification:
   - `src/modules/inventory/interface/rust-items-proxy.ts`
   - `src/modules/inventory/interface/rust-stock-settings-proxy.ts`
   - `apps/api-rust/src/main.rs`
5. Status: fixed.

