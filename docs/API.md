# miniERP API (v1)

Optional REST API for integrations. All endpoints require authentication.

## Authentication

Set one of:

- **Header:** `Authorization: Bearer YOUR_API_KEY`
- **Query:** `?apiKey=YOUR_API_KEY`

Environment variables:

- `API_KEY` – required for API access; set in `.env`. If unset, all API routes return 401.
- `API_ORG_ID` – org scope for API data (default: `default-org`).

## Endpoints

Base URL: `/api/v1`

### GET /api/v1/customers

Returns up to 100 customers for the configured org.

**Response:** `{ "data": [ { "id", "orgId", "name", "email", "phone", "address", "createdAt", "updatedAt" }, ... ] }`

### POST /api/v1/customers

Create a customer.

**Body (JSON):**

- `name` (string, required)
- `email` (string, optional)
- `phone` (string, optional)
- `address` (string, optional)

**Response:** `{ "data": { "id", "orgId", "name", ... } }`

### GET /api/v1/products

Returns up to 100 products for the configured org.

**Response:** `{ "data": [ { "id", "orgId", "sku", "name", "unit", "priceCents", ... }, ... ] }`

## Errors

- `401 Unauthorized` – missing or invalid API key.
- `400 Bad Request` – validation error (e.g. missing required field).
