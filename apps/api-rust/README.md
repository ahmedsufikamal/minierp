# api-rust

Axum + SQLx service scaffold for the miniERP strangler migration.

## Run

```bash
cd apps/api-rust
RUST_API_BIND=127.0.0.1:4000 \
RUST_TRUSTED_PROXY_SECRET=replace-with-32-plus-char-secret \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/minierp \
cargo run
```

## Endpoints

- `GET /api/health`
- `GET /api/v1/ping`
- `GET /api/v1/inventory/items`
- `POST /api/v1/inventory/items`
- `GET /api/v1/inventory/items/:item_id`

## Notes

- Current tenancy model target is shared-schema with strict `tenant_id` + `company_id` scoping.
- Use SQLx migrations in `apps/api-rust/migrations` for migrated slices.
