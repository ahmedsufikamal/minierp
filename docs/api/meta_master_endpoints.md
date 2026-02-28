# Meta + Master API Endpoints

All endpoints are tenant/company scoped through authenticated context.

## Headers
- `Cookie: iam_session=...`
- `x-company-id: <company-id>` (optional if active company is already selected)

## Metadata

```bash
curl -X GET "$BASE_URL/api/v1/meta/models?page=1&limit=50"
```

```bash
curl -X GET "$BASE_URL/api/v1/meta/models/Party"
```

```bash
curl -X GET "$BASE_URL/api/v1/meta/models/Party/compiled?version=2" \
  -H 'If-None-Match: "<etag>"'
```

```bash
curl -X POST "$BASE_URL/api/v1/meta/models" \
  -H 'Content-Type: application/json' \
  -d '{"name":"CustomDoc","label":"Custom Doc"}'
```

```bash
curl -X PATCH "$BASE_URL/api/v1/meta/models/Party" \
  -H 'Content-Type: application/json' \
  -d '{"action":"PUBLISH"}'
```

```bash
curl -X POST "$BASE_URL/api/v1/meta/custom-fields" \
  -H 'Content-Type: application/json' \
  -d '{"modelName":"Party","fieldKey":"credit_limit","label":"Credit Limit","dataType":"NUMBER"}'
```

```bash
curl -X DELETE "$BASE_URL/api/v1/meta/custom-fields/<field-id>"
```

```bash
curl -X POST "$BASE_URL/api/v1/meta/workflows/Party/draft" \
  -H 'Content-Type: application/json' \
  -d '{
    "states":[{"stateKey":"DRAFT","label":"Draft","isInitial":true},{"stateKey":"ACTIVE","label":"Active"}],
    "transitions":[{"actionKey":"ACTIVATE","fromState":"DRAFT","toState":"ACTIVE"}]
  }'
```

```bash
curl -X POST "$BASE_URL/api/v1/meta/workflows/Party/publish"
```

```bash
curl -X GET "$BASE_URL/api/v1/meta/workflows/Party"
```

```bash
curl -X POST "$BASE_URL/api/v1/meta/print-templates" \
  -H 'Content-Type: application/json' \
  -d '{"modelName":"Party","name":"party-profile","templateType":"HTML","draftTemplate":"<h1>{{name}}</h1>"}'
```

```bash
curl -X POST "$BASE_URL/api/v1/meta/print-templates/<template-id>/publish"
```

```bash
curl -X GET "$BASE_URL/api/v1/meta/print-templates/<template-id>/render?recordId=<record-id>"
```

```bash
curl -X GET "$BASE_URL/api/v1/meta/export"
```

```bash
curl -X POST "$BASE_URL/api/v1/meta/import" \
  -H 'Content-Type: application/json' \
  -d '{"models":[]}'
```

```bash
curl -X GET "$BASE_URL/api/v1/meta/audit?model=Party&limit=100"
```

## Master Data

```bash
curl -X GET "$BASE_URL/api/v1/master/items?query=sku&limit=25"
```

```bash
curl -X POST "$BASE_URL/api/v1/master/items" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Item A","brandId":"<brand-id>","customData":{"color":"red"}}'
```

```bash
curl -X PATCH "$BASE_URL/api/v1/master/items/<item-id>" \
  -H 'Content-Type: application/json' \
  -d '{"itemStatus":"APPROVED"}'
```

```bash
curl -X GET "$BASE_URL/api/v1/master/parties?query=customer"
```

```bash
curl -X POST "$BASE_URL/api/v1/master/parties" \
  -H 'Content-Type: application/json' \
  -d '{"partyCode":"CUST-0001","name":"Acme","partyType":"CUSTOMER","status":"ACTIVE"}'
```

```bash
curl -X PATCH "$BASE_URL/api/v1/master/parties/<party-id>" \
  -H 'Content-Type: application/json' \
  -d '{"status":"ACTIVE"}'
```

```bash
curl -X POST "$BASE_URL/api/v1/master/parties/<source-id>/merge" \
  -H 'Content-Type: application/json' \
  -d '{"targetPartyId":"<target-id>","note":"dedup merge"}'
```

```bash
curl -X GET "$BASE_URL/api/v1/master/uom"
```

```bash
curl -X GET "$BASE_URL/api/v1/master/warehouses"
```

```bash
curl -X GET "$BASE_URL/api/v1/master/pricelists"
```

```bash
curl -X POST "$BASE_URL/api/v1/master/pricelists" \
  -H 'Content-Type: application/json' \
  -d '{"key":"STANDARD","name":"Standard","currency":"USD","status":"DRAFT","items":[]}'
```

```bash
curl -X GET "$BASE_URL/api/v1/master/currencies"
```

```bash
curl -X GET "$BASE_URL/api/v1/master/taxcodes"
```

```bash
curl -X POST "$BASE_URL/api/v1/master/number-series/SKU/next" \
  -H 'Content-Type: application/json' \
  -d '{}'
```
