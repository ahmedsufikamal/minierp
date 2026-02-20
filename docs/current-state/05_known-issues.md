# 05 Known Issues (AS-IS)

Captured on 2026-02-20 from `docs/current-state/logs/*` and direct runtime probes.

## 1) Auth sign-in self-redirect loop
Status: Fixed on 2026-02-20.
1. Reproduction steps
   - Start dev server.
   - Request `GET /auth/sign-in`.
   - Observe `307` redirect to `/auth/sign-in`.
2. Root cause
   - `src/app/layout.tsx` invokes `getCurrentUser()`.
   - `getCurrentUser()` invokes `verifySession()`.
   - `verifySession()` redirects unauthenticated users, including on public auth route renders.
3. Candidate fix
   - Add non-redirecting user resolution for root layout (`getCurrentUserSafe()` using principal resolver).
   - Keep redirecting auth enforcement in protected app layout and route guards.
4. Test/check evidence
   - `docs/current-state/logs/20_dev_server.log`
   - `docs/current-state/logs/21_dev_auth_signin_probe.log`
5. Verification steps
   - `curl -i http://localhost:3101/auth/sign-in` should return `200` unauthenticated.

## 2) Production startup path returns 500 on missing required security secret
1. Reproduction steps
   - Start prod server without `INVENTORY_STORAGE_SIGNING_SECRET` (>=32 chars).
   - Request `/auth/sign-in`.
2. Root cause
   - `assertProductionSecurityEnv()` executes in root layout and throws when required secret missing.
3. Candidate fix
   - Keep hard-fail behavior for security, but improve health/startup diagnostics and deployment docs.
4. Test/check evidence
   - `docs/current-state/logs/23_prod_server.log`
   - `docs/current-state/logs/24_prod_auth_signin_probe.log`
5. Verification steps
   - Set valid production secrets and verify `/auth/sign-in` no longer returns `500`.

## 3) Pending migrations create schema drift risk
1. Reproduction steps
   - Run `npx prisma migrate status`.
2. Root cause
   - Two migrations are present but unapplied in current local DB.
3. Candidate fix
   - Apply migrations (`npm run prisma:migrate:deploy`) in runtime environments before test/build gates.
4. Test/check evidence
   - `docs/current-state/logs/15_prisma_migrate_status.log`
5. Verification steps
   - Re-run `npx prisma migrate status` and confirm no unapplied migrations.

## 4) Seed fails with DB reachability error in this execution context
1. Reproduction steps
   - Run `npm run prisma:seed`.
2. Root cause
   - Prisma seed process cannot reach DB in this context (`127.0.0.1:5432`), while direct `psql` probe succeeds outside sandbox restrictions.
3. Candidate fix
   - Align seed runtime environment/network permissions with DB access; enforce a preflight DB connectivity check before seed.
4. Test/check evidence
   - `docs/current-state/logs/17_prisma_seed.log`
   - `docs/current-state/logs/18_psql_probe.log`
5. Verification steps
   - Run `npm run prisma:seed` in DB-reachable execution context and confirm completion.

## 5) Health endpoint is shallow
Status: Fixed on 2026-02-20.
1. Reproduction steps
   - Request `GET /api/health`.
2. Root cause
   - Endpoint currently returns only `{ ok, ts }`, without dependency checks (DB/queue/version).
3. Candidate fix
   - Extend health payload with dependency status and request correlation metadata.
4. Test/check evidence
   - `docs/current-state/logs/22_dev_health_probe.log`
   - `docs/current-state/logs/25_prod_health_probe.log`
5. Verification steps
   - Validate expanded payload fields and non-sensitive failure semantics.

## 6) Legacy invoice UI could never submit when optional date field was null
Status: Fixed on 2026-02-20.
1. Reproduction steps
   - Open `/invoices`.
   - Fill required invoice fields.
   - Submit without an `invoiceDate` field present in form data.
2. Root cause
   - `src/app/(app)/invoices/actions.ts` expected `invoiceDate` as `z.string().optional()`.
   - `FormData.get("invoiceDate")` returned `null`, causing schema validation failure (`expected string, received null`).
3. Candidate fix
   - Accept nullable optional fields with `z.string().nullish()` for `issueDate`, `invoiceDate`, `dueDate`, and `notes`.
   - Keep `toDateOrUndefined` null-safe.
4. Test/check evidence
   - `tests/e2e/smoke/critical-flows.spec.ts`
   - `npm run test:e2e:smoke` (in port-enabled runtime)
5. Verification steps
   - Submit invoice from `/invoices`; ensure record persists and appears in DB/UI.
