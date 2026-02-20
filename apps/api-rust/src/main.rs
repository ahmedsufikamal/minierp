use axum::{
    extract::{Path, Query, State},
    http::{header::HeaderName, HeaderMap, StatusCode},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, FromRow, PgPool};
use std::{
    env,
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tower_http::{
    propagate_header::PropagateHeaderLayer,
    request_id::{MakeRequestUuid, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db_pool: Option<PgPool>,
    app_version: String,
    trusted_proxy_secret: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct HealthResponse {
    ok: bool,
    service: &'static str,
    version: String,
    ts_ms: u128,
    dependencies: HealthDependencies,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct HealthDependencies {
    db: &'static str,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct PingResponse {
    ok: bool,
    message: &'static str,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct ApiErrorBody {
    code: String,
    message: String,
    details: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct ErrorEnvelope {
    ok: bool,
    error: ApiErrorBody,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryItemBrandRef {
    id: String,
    name: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryItemView {
    id: String,
    sku: String,
    name: String,
    description: Option<String>,
    uom: String,
    #[serde(rename = "unitCostMinor")]
    unit_cost_minor: Option<i32>,
    #[serde(rename = "priceCents")]
    price_cents: i32,
    #[serde(rename = "trackSerial")]
    track_serial: bool,
    #[serde(rename = "trackBatch")]
    track_batch: bool,
    #[serde(rename = "lowStockThreshold")]
    low_stock_threshold: Option<i32>,
    #[serde(rename = "isActive")]
    is_active: bool,
    brand: InventoryItemBrandRef,
    #[serde(rename = "customFields")]
    custom_fields: Value,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryItemListData {
    page: i64,
    limit: i64,
    total: i64,
    rows: Vec<InventoryItemView>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryItemsListResponse {
    ok: bool,
    data: InventoryItemListData,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryItemResponse {
    ok: bool,
    data: InventoryItemView,
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
struct InventoryItemListQuery {
    page: Option<i64>,
    limit: Option<i64>,
    q: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct CreateInventoryItemRequest {
    sku: String,
    name: String,
    description: Option<String>,
    #[serde(rename = "brandId")]
    brand_id: String,
    uom: Option<String>,
    #[serde(rename = "unitCostMinor")]
    unit_cost_minor: Option<i32>,
    #[serde(rename = "priceCents")]
    price_cents: Option<i32>,
    #[serde(rename = "trackSerial")]
    track_serial: Option<bool>,
    #[serde(rename = "trackBatch")]
    track_batch: Option<bool>,
    #[serde(rename = "lowStockThreshold")]
    low_stock_threshold: Option<i32>,
    #[serde(rename = "isActive")]
    is_active: Option<bool>,
}

#[derive(Debug, Clone)]
struct InventoryRequestContext {
    company_id: String,
    tenant_id: String,
    user_id: String,
    request_id: String,
}

#[derive(Debug, FromRow)]
struct InventoryItemDbRow {
    id: String,
    sku: String,
    name: String,
    description: Option<String>,
    uom: String,
    unit_cost_minor: Option<i32>,
    price_cents: i32,
    track_serial: bool,
    track_batch: bool,
    low_stock_threshold: Option<i32>,
    is_active: bool,
    brand_id: String,
    brand_name: String,
}

fn api_error(
    status: StatusCode,
    code: &str,
    message: impl Into<String>,
) -> (StatusCode, Json<ErrorEnvelope>) {
    (
        status,
        Json(ErrorEnvelope {
            ok: false,
            error: ApiErrorBody {
                code: code.to_string(),
                message: message.into(),
                details: None,
            },
        }),
    )
}

fn header_value(headers: &HeaderMap, key: &str) -> Option<String> {
    headers
        .get(key)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_sku(raw: &str) -> String {
    raw.split_whitespace()
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase()
}

fn map_item(row: InventoryItemDbRow) -> InventoryItemView {
    InventoryItemView {
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        uom: row.uom,
        unit_cost_minor: row.unit_cost_minor,
        price_cents: row.price_cents,
        track_serial: row.track_serial,
        track_batch: row.track_batch,
        low_stock_threshold: row.low_stock_threshold,
        is_active: row.is_active,
        brand: InventoryItemBrandRef {
            id: row.brand_id,
            name: row.brand_name,
        },
        custom_fields: json!({}),
    }
}

fn resolve_inventory_context(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<InventoryRequestContext, (StatusCode, Json<ErrorEnvelope>)> {
    if let Some(expected_secret) = &state.trusted_proxy_secret {
        let provided_secret = header_value(headers, "x-minierp-proxy-secret");
        if provided_secret.as_deref() != Some(expected_secret.as_str()) {
            return Err(api_error(
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "Missing or invalid trusted proxy secret",
            ));
        }
    }

    let company_id = header_value(headers, "x-minierp-company-id")
        .or_else(|| header_value(headers, "x-company-id"))
        .ok_or_else(|| {
            api_error(
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
                "Missing inventory company context",
            )
        })?;

    let tenant_id =
        header_value(headers, "x-minierp-tenant-id").unwrap_or_else(|| company_id.clone());
    let user_id =
        header_value(headers, "x-minierp-user-id").unwrap_or_else(|| "rust-inventory".to_string());
    let request_id =
        header_value(headers, "x-request-id").unwrap_or_else(|| Uuid::new_v4().to_string());

    Ok(InventoryRequestContext {
        company_id,
        tenant_id,
        user_id,
        request_id,
    })
}

async fn fetch_inventory_item_by_id(
    pool: &PgPool,
    company_id: &str,
    item_id: &str,
) -> Result<Option<InventoryItemDbRow>, sqlx::Error> {
    sqlx::query_as::<_, InventoryItemDbRow>(
        r#"
        SELECT
          p."id" AS id,
          p."sku" AS sku,
          p."name" AS name,
          p."description" AS description,
          p."uom" AS uom,
          p."unitCostMinor" AS unit_cost_minor,
          p."priceCents" AS price_cents,
          p."trackSerial" AS track_serial,
          p."trackBatch" AS track_batch,
          p."lowStockThreshold" AS low_stock_threshold,
          p."isActive" AS is_active,
          b."id" AS brand_id,
          b."name" AS brand_name
        FROM "Product" p
        INNER JOIN "Brand" b ON b."id" = p."brandId"
        WHERE p."orgId" = $1 AND p."id" = $2
        LIMIT 1
        "#,
    )
    .bind(company_id)
    .bind(item_id)
    .fetch_optional(pool)
    .await
}

#[utoipa::path(
    get,
    path = "/api/health",
    tag = "system",
    responses((status = 200, body = HealthResponse))
)]
async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let db_status = if let Some(pool) = &state.db_pool {
        match sqlx::query_scalar::<_, i32>("select 1")
            .fetch_one(pool)
            .await
        {
            Ok(_) => "up",
            Err(error) => {
                warn!(error = %error, "db health probe failed");
                "down"
            }
        }
    } else {
        "not_configured"
    };

    let ts_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis());

    Json(HealthResponse {
        ok: db_status != "down",
        service: "miniERP-rust-api",
        version: state.app_version.clone(),
        ts_ms,
        dependencies: HealthDependencies { db: db_status },
    })
}

#[utoipa::path(
    get,
    path = "/api/v1/ping",
    tag = "system",
    responses((status = 200, body = PingResponse))
)]
async fn ping() -> Json<PingResponse> {
    Json(PingResponse {
        ok: true,
        message: "miniERP rust api alive",
    })
}

#[utoipa::path(
    get,
    path = "/api/v1/inventory/items",
    tag = "inventory",
    params(InventoryItemListQuery),
    responses(
        (status = 200, body = InventoryItemsListResponse),
        (status = 401, body = ErrorEnvelope),
        (status = 403, body = ErrorEnvelope),
        (status = 503, body = ErrorEnvelope)
    )
)]
async fn list_inventory_items(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<InventoryItemListQuery>,
) -> Result<Json<InventoryItemsListResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "list inventory items"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(25).clamp(1, 200);
    let offset = (page - 1) * limit;
    let search = query
        .q
        .as_ref()
        .map(|raw| raw.trim())
        .filter(|raw| !raw.is_empty())
        .map(|raw| format!("%{raw}%"));

    let rows = sqlx::query_as::<_, InventoryItemDbRow>(
        r#"
        SELECT
          p."id" AS id,
          p."sku" AS sku,
          p."name" AS name,
          p."description" AS description,
          p."uom" AS uom,
          p."unitCostMinor" AS unit_cost_minor,
          p."priceCents" AS price_cents,
          p."trackSerial" AS track_serial,
          p."trackBatch" AS track_batch,
          p."lowStockThreshold" AS low_stock_threshold,
          p."isActive" AS is_active,
          b."id" AS brand_id,
          b."name" AS brand_name
        FROM "Product" p
        INNER JOIN "Brand" b ON b."id" = p."brandId"
        WHERE p."orgId" = $1
          AND (
            $2::text IS NULL
            OR p."sku" ILIKE $2
            OR p."name" ILIKE $2
            OR COALESCE(p."description", '') ILIKE $2
          )
        ORDER BY p."createdAt" DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(&ctx.company_id)
    .bind(search.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to list inventory items");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load inventory items",
        )
    })?;

    let total = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)::bigint
        FROM "Product" p
        WHERE p."orgId" = $1
          AND (
            $2::text IS NULL
            OR p."sku" ILIKE $2
            OR p."name" ILIKE $2
            OR COALESCE(p."description", '') ILIKE $2
          )
        "#,
    )
    .bind(&ctx.company_id)
    .bind(search.as_deref())
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to count inventory items");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to count inventory items",
        )
    })?;

    let data = InventoryItemListData {
        page,
        limit,
        total,
        rows: rows.into_iter().map(map_item).collect(),
    };

    Ok(Json(InventoryItemsListResponse { ok: true, data }))
}

#[utoipa::path(
    post,
    path = "/api/v1/inventory/items",
    tag = "inventory",
    request_body = CreateInventoryItemRequest,
    responses(
        (status = 200, body = InventoryItemResponse),
        (status = 400, body = ErrorEnvelope),
        (status = 401, body = ErrorEnvelope),
        (status = 403, body = ErrorEnvelope),
        (status = 409, body = ErrorEnvelope),
        (status = 503, body = ErrorEnvelope)
    )
)]
async fn create_inventory_item(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateInventoryItemRequest>,
) -> Result<(StatusCode, Json<InventoryItemResponse>), (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "create inventory item"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let normalized_sku = normalize_sku(&payload.sku);
    if normalized_sku.is_empty() {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "sku is required",
        ));
    }

    if payload.name.trim().is_empty() {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "name is required",
        ));
    }

    let brand_exists = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)::bigint
        FROM "Brand"
        WHERE "id" = $1 AND "orgId" = $2
        "#,
    )
    .bind(&payload.brand_id)
    .bind(&ctx.company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to validate brand");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to validate brand",
        )
    })?;

    if brand_exists == 0 {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "Invalid brandId for this company",
        ));
    }

    let conflict = sqlx::query_scalar::<_, Option<String>>(
        r#"
        SELECT "id"
        FROM "Product"
        WHERE "orgId" = $1 AND "brandId" = $2 AND "normalizedSku" = $3
        LIMIT 1
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&payload.brand_id)
    .bind(&normalized_sku)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to detect sku conflict");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to create item",
        )
    })?;

    if conflict.is_some() {
        return Err(api_error(
            StatusCode::CONFLICT,
            "CONFLICT",
            "SKU already exists for this brand",
        ));
    }

    let item_id = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO "Product" (
          "orgId",
          "brandId",
          "sku",
          "normalizedSku",
          "title",
          "name",
          "description",
          "uom",
          "priceCents",
          "unitCostMinor",
          "trackSerial",
          "trackBatch",
          "lowStockThreshold",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          NOW(), NOW()
        )
        RETURNING "id"
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&payload.brand_id)
    .bind(payload.sku.trim())
    .bind(&normalized_sku)
    .bind(payload.name.trim())
    .bind(payload.name.trim())
    .bind(payload.description.as_deref())
    .bind(payload.uom.as_deref().unwrap_or("pcs"))
    .bind(payload.price_cents.unwrap_or(0))
    .bind(payload.unit_cost_minor.unwrap_or(0))
    .bind(payload.track_serial.unwrap_or(false))
    .bind(payload.track_batch.unwrap_or(false))
    .bind(payload.low_stock_threshold)
    .bind(payload.is_active.unwrap_or(true))
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to insert inventory item");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to create item",
        )
    })?;

    let _ = sqlx::query(
        r#"
        INSERT INTO "InventoryItemIdentifier" (
          "orgId",
          "itemId",
          "kind",
          "value",
          "isPrimary",
          "metadata",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, 'SKU', $3, TRUE, NULL, NOW(), NOW())
        ON CONFLICT ("orgId", "value")
        DO UPDATE SET
          "itemId" = EXCLUDED."itemId",
          "kind" = EXCLUDED."kind",
          "isPrimary" = TRUE,
          "updatedAt" = NOW()
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&item_id)
    .bind(payload.sku.trim())
    .execute(pool)
    .await;

    let item = fetch_inventory_item_by_id(pool, &ctx.company_id, &item_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to fetch created inventory item");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load created item",
            )
        })?
        .map(map_item)
        .ok_or_else(|| {
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Created item could not be reloaded",
            )
        })?;

    Ok((
        StatusCode::CREATED,
        Json(InventoryItemResponse {
            ok: true,
            data: item,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/inventory/items/{item_id}",
    tag = "inventory",
    params(("item_id" = String, Path, description = "Inventory item id")),
    responses(
        (status = 200, body = InventoryItemResponse),
        (status = 401, body = ErrorEnvelope),
        (status = 403, body = ErrorEnvelope),
        (status = 404, body = ErrorEnvelope),
        (status = 503, body = ErrorEnvelope)
    )
)]
async fn get_inventory_item(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(item_id): Path<String>,
) -> Result<Json<InventoryItemResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "get inventory item"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let row = fetch_inventory_item_by_id(pool, &ctx.company_id, &item_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to fetch inventory item");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load inventory item",
            )
        })?;

    let item =
        row.ok_or_else(|| api_error(StatusCode::NOT_FOUND, "NOT_FOUND", "Item not found"))?;

    Ok(Json(InventoryItemResponse {
        ok: true,
        data: map_item(item),
    }))
}

fn build_router(state: Arc<AppState>) -> Router {
    let request_id_header = HeaderName::from_static("x-request-id");

    Router::new()
        .route("/api/health", get(health))
        .route("/api/v1/ping", get(ping))
        .route(
            "/api/v1/inventory/items",
            get(list_inventory_items).post(create_inventory_item),
        )
        .route("/api/v1/inventory/items/:item_id", get(get_inventory_item))
        .layer(TraceLayer::new_for_http())
        .layer(PropagateHeaderLayer::new(request_id_header.clone()))
        .layer(SetRequestIdLayer::new(request_id_header, MakeRequestUuid))
        .with_state(state)
}

async fn connect_db() -> Option<PgPool> {
    let database_url = match env::var("DATABASE_URL") {
        Ok(value) => value,
        Err(_) => {
            warn!("DATABASE_URL is not set; db-dependent endpoints will report not_configured");
            return None;
        }
    };

    match PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url)
        .await
    {
        Ok(pool) => Some(pool),
        Err(error) => {
            warn!(error = %error, "failed to connect to postgres at startup");
            None
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_current_span(true)
                .with_span_list(true),
        )
        .init();

    let bind_addr = env::var("RUST_API_BIND").unwrap_or_else(|_| "127.0.0.1:4000".to_string());
    let socket_addr: SocketAddr = bind_addr.parse()?;

    let state = Arc::new(AppState {
        db_pool: connect_db().await,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        trusted_proxy_secret: env::var("RUST_TRUSTED_PROXY_SECRET")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
    });

    let router = build_router(state);

    info!(%socket_addr, "starting miniERP rust api");

    let listener = tokio::net::TcpListener::bind(socket_addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}
