FROM rust:1.91-bookworm AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
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
