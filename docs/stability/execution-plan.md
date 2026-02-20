# Step-by-Step Execution Plan (Local)

## Phase 0: AS-IS capture
```bash
mkdir -p docs/current-state/logs docs/stability docs/target-architecture tests/e2e
(node -v && npm -v && npx prisma -v) 2>&1 | tee docs/current-state/logs/00_toolchain.log
npm ci 2>&1 | tee docs/current-state/logs/10_npm_ci.log
npm run lint 2>&1 | tee docs/current-state/logs/11_lint.log
npm run typecheck 2>&1 | tee docs/current-state/logs/12_typecheck.log
npm run test:unit 2>&1 | tee docs/current-state/logs/13_test_unit.log
npm run build 2>&1 | tee docs/current-state/logs/14_build.log
npx prisma migrate status 2>&1 | tee docs/current-state/logs/15_prisma_migrate_status.log
npx prisma validate 2>&1 | tee docs/current-state/logs/16_prisma_validate.log
npm run prisma:seed 2>&1 | tee docs/current-state/logs/17_prisma_seed.log
```

## Phase 1: stabilization verification
```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e:smoke
```

## Phase 2: target architecture docs
```bash
ls docs/target-architecture/
```
Expected files: `00_principles.md` … `06_customization.md`.

## Phase 3: Rust scaffold validation
```bash
cargo fmt --all --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

## Unified local gate
```bash
scripts/check.sh
```
