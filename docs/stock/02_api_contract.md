# Stock Module API Contract (Target)

All endpoints use envelope:
- Success: `{ "ok": true, "data": ... }`
- Error: `{ "ok": false, "error": { "code": "...", "message": "...", "details": ... } }`

All queries and writes are company/tenant scoped from authenticated context; client must not pass arbitrary company IDs.

## Workspace

### `GET /api/stock/workspace/metrics`
```json
{
  "ok": true,
  "data": {
    "total_stock_value": { "amount": 1272000000, "currency": "BDT" },
    "total_warehouses": 26,
    "total_active_items": 54,
    "last_synced_at": "2026-02-21T18:00:00.000Z"
  }
}
```

### `GET /api/stock/workspace/warehouse-stock-value`
```json
{
  "ok": true,
  "data": {
    "last_synced_at": "2026-02-21T18:00:00.000Z",
    "series": [
      {
        "warehouse_id": "wh_1",
        "warehouse_name": "Stores - GH",
        "stock_value": { "amount": 58000000, "currency": "BDT" }
      }
    ]
  }
}
```

### `GET /api/stock/workspace/quick-access`
```json
{
  "ok": true,
  "data": {
    "items_available": 54,
    "delivery_note_to_bill": 20,
    "material_request_pending": 12,
    "purchase_receipt_to_bill": 16
  }
}
```

## Items list

### `GET /api/stock/items`
Query:
- `page` (default `1`)
- `page_size` (default `20`, max `2500`)
- `query`
- `item_group`
- `has_variants` (`true|false`)
- `variant_of`
- `assigned_to`
- `created_by`
- `tags` (comma-separated)
- `sort` (default `last_updated_desc`)

```json
{
  "ok": true,
  "data": {
    "total": 54,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "id": "prod_1",
        "item_name": "Samsung",
        "status": "ENABLED",
        "item_group": "Android",
        "item_code": "1245879541",
        "updated_at": "2026-02-21T18:00:00.000Z",
        "has_variants": false,
        "variant_of": null,
        "assigned_to": null,
        "created_by": "user_1",
        "tags": ["mobile", "featured"]
      }
    ]
  }
}
```

## Stock settings

### Existing
- `GET /api/stock/settings`
- `PATCH /api/stock/settings`
- `PUT /api/stock/settings`

Write authorization:
- level `>= 4` (`ADMINISTRATOR_USER`/`MASTER_USER`/`SUPER_USER`)

### New settings side-panel feeds

#### `GET /api/stock/settings/activity`
```json
{
  "ok": true,
  "data": {
    "rows": [
      {
        "id": "audit_1",
        "type": "SETTINGS_UPDATED",
        "message": "Stock settings updated",
        "actor_user_id": "user_1",
        "created_at": "2026-02-21T18:00:00.000Z",
        "metadata": { "changed_fields": ["allow_negative_stock"] }
      },
      {
        "id": "comment_1",
        "type": "COMMENT_ADDED",
        "message": "Please review freeze threshold.",
        "actor_user_id": "user_2",
        "created_at": "2026-02-21T18:01:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/stock/settings/comments`
```json
{
  "ok": true,
  "data": {
    "rows": [
      {
        "id": "comment_1",
        "user_id": "user_2",
        "comment": "Please review freeze threshold.",
        "created_at": "2026-02-21T18:01:00.000Z",
        "updated_at": "2026-02-21T18:01:00.000Z",
        "is_edited": false
      }
    ]
  }
}
```

#### `POST /api/stock/settings/comments`
Request:
```json
{
  "comment": "Please review freeze threshold."
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "id": "comment_1",
    "user_id": "user_2",
    "comment": "Please review freeze threshold.",
    "created_at": "2026-02-21T18:01:00.000Z",
    "updated_at": "2026-02-21T18:01:00.000Z",
    "is_edited": false
  }
}
```
