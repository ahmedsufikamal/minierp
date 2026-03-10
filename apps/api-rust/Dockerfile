FROM rust:1.91-bookworm AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY apps/api-rust/Cargo.toml apps/api-rust/Cargo.toml
COPY crates/domain/Cargo.toml crates/domain/Cargo.toml

RUN mkdir -p apps/api-rust/src crates/domain/src \
  && printf 'fn main() {}\n' > apps/api-rust/src/main.rs \
  && printf 'pub fn placeholder() {}\n' > crates/domain/src/lib.rs \
  && cargo build --release -p api-rust \
  && rm -rf apps/api-rust/src crates/domain/src

COPY apps/api-rust ./apps/api-rust
COPY crates/domain ./crates/domain

RUN cargo build --release -p api-rust

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/api-rust /usr/local/bin/api-rust

ENV PORT=8080
EXPOSE 8080
CMD ["api-rust"]
