# Top 20 Prioritized Issues

| # | Severity | Owner | Issue | Current Status |
|---|---|---|---|---|
| 1 | Critical | IAM/Auth + Platform FE | `/auth/sign-in` redirect loop for unauthenticated users | Fixed |
| 2 | High | Runtime/Platform | Missing required production secret causes startup/auth failures | Open |
| 3 | High | Data/Platform | Pending Prisma migrations drift risk | Open |
| 4 | High | Data/Infra | Seed reliability differs by execution context | Open |
| 5 | High | Platform Backend | No global tenant/company query guard across all legacy services | In progress |
| 6 | High | Security | Mixed auth paths need strict standardization | In progress |
| 7 | High | QA + Platform | Cross-tenant denial tests incomplete across core flows | In progress |
| 8 | High | QA | Missing consolidated smoke flow command and tests | Fixed |
| 9 | Medium | QA/Runtime | Playwright startup brittle under Turbopack in restricted environments | Mitigated (webpack e2e build path) |
| 10 | Medium | Runtime | `/api/health` lacked dependency checks | Fixed |
| 11 | Medium | Observability | Structured logging inconsistent across modules | In progress |
| 12 | Medium | Observability | Request ID propagation incomplete | In progress |
| 13 | Medium | API Platform | Error envelope shaping duplicated | In progress |
| 14 | Medium | Docs | API/auth-tenancy docs not fully synchronized | In progress |
| 15 | Medium | Frontend | Theme semantic consistency gaps on all states/surfaces | In progress |
| 16 | Medium | QA/Frontend | Automated contrast/state checks are limited | In progress |
| 17 | Medium | Release Eng | No single unified local check gate across TS + Rust + e2e | In progress (`scripts/check.sh`) |
| 18 | Medium | Rust Platform | Rust service not scaffolded | Fixed (scaffolded) |
| 19 | Low | DevOps | Local compose/profile for Rust sidecar not defined | Open |
| 20 | Low | Architecture | ADR/cutover rollback criteria for each slice not formalized | Open |
