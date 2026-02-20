# Stability Definition of Done

## Runtime and auth
- [x] Unauthenticated `/auth/sign-in` loads without self-redirect loop
- [x] Login/logout works with IAM session cookies
- [ ] Session refresh/bridge path works after navigation

## Tenant and organization isolation
- [x] Organization/company creation works from UI
- [ ] Company switching works and membership is enforced
- [ ] Cross-tenant read/write attempts are denied (`403/404`)

## Core CRUD (minimum)
- [x] Create Item/Product
- [x] Create Customer
- [x] Create Invoice

## Theme and UX stability
- [x] Light/Dark/System preference persists across refresh and route changes
- [x] System mode follows OS preference changes
- [ ] Text contrast remains readable on cards, tables, modals, dropdowns, sidebar, forms

## Responsiveness and shell behavior
- [ ] Left menu and top bar render correctly on desktop/mobile
- [ ] No major layout jumps on route navigation

## Runtime quality and observability
- [ ] No blocking console/runtime errors on key pages
- [x] `/api/health` returns dependency-aware status
- [ ] Responses include request correlation ID

## Local quality gates
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:unit`
- [x] `npm run build`
- [ ] DB-backed integration tests in DB-enabled environment
- [x] E2E smoke pack passes

## Unified gate command
- `scripts/check.sh` runs the local combined gate for frontend + rust + smoke e2e.
