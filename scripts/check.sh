#!/usr/bin/env bash
set -euo pipefail

npm run lint
npm run typecheck
npm run test:unit
npm run build

cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

npm run test:e2e:smoke
