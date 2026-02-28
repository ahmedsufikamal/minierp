# Module B/C Architecture Decision

## Decision
Module B (Metadata / Low-code) and Module C (Master Data Management) are implemented in the existing Next.js backend layer (App Router route handlers + TS services + Prisma).

## Rationale
1. Existing auth context, tenant/company scoping, and permission checks are already centralized in `withPlatformAuth` + `getPlatformRequestContext`.
2. Existing audit/immutable-ledger hooks are already available in platform services.
3. Existing migration toolchain and schema ownership are Prisma-first in this repository.
4. Implementing in one backend layer avoids split-domain logic and duplicate authorization in the same pass.

## Boundaries
- Rust service remains unchanged for these modules in this delivery.
- Next.js remains edge/API surface for:
- `/api/v1/meta/*`
- `/api/v1/master/*`
- Existing Rust inventory proxy paths continue to work independently.

## Runtime Flow
1. Request enters Next route handler.
2. `withPlatformAuth` resolves principal, tenant, company, permissions.
3. Service layer applies server-side authorization + tenant/company scoping.
4. Metadata reads prefer published/compiled version; drafts require `meta.read_drafts`.
5. Publish operations compile metadata and write immutable version rows with cache invalidation.
6. Audit events are appended for metadata changes, publish operations, and master merge actions.
