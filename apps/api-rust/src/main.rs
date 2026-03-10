use axum::{
    extract::{Path, Query, State},
    http::{header::HeaderName, HeaderMap, StatusCode},
    routing::{get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{
    postgres::PgPoolOptions,
    types::{
        chrono::{NaiveDateTime, Utc},
        Json as SqlJson,
    },
    FromRow, PgPool,
};
use std::{
    collections::HashMap,
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

#[derive(Debug, Deserialize, ToSchema)]
struct UpdateInventoryItemRequest {
    sku: Option<String>,
    name: Option<String>,
    description: Option<String>,
    #[serde(rename = "brandId")]
    brand_id: Option<String>,
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

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryLocationView {
    id: String,
    code: String,
    name: String,
    #[serde(rename = "isActive")]
    is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryWarehouseParentRef {
    id: String,
    code: String,
    name: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryWarehouseView {
    id: String,
    code: String,
    name: String,
    description: Option<String>,
    #[serde(rename = "parentWarehouse")]
    parent_warehouse: Option<InventoryWarehouseParentRef>,
    address: Value,
    #[serde(rename = "isActive")]
    is_active: bool,
    locations: Vec<InventoryLocationView>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryWarehousesResponse {
    ok: bool,
    data: Vec<InventoryWarehouseView>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryWarehouseResponse {
    ok: bool,
    data: InventoryWarehouseView,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct InventoryLocationResponse {
    ok: bool,
    data: InventoryLocationView,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
struct StockSettingsView {
    item_naming_by: String,
    default_warehouse_id: Option<String>,
    default_stock_uom_id: Option<String>,
    default_valuation_method: String,
    auto_insert_item_price_if_missing: bool,
    update_existing_price_list_rate: bool,
    allow_edit_stock_uom_qty_sales_docs: bool,
    allow_edit_stock_uom_qty_purchase_docs: bool,
    over_delivery_receipt_allowance_pct: f64,
    over_transfer_allowance_pct: f64,
    over_picking_allowance_pct: f64,
    allow_negative_stock: bool,
    show_barcode_field_in_stock_transactions: bool,
    convert_item_description_to_clean_html: bool,
    allow_internal_transfers_at_arms_length_price: bool,
    qi_action_if_not_submitted: String,
    qi_action_if_rejected: String,
    enable_stock_reservation: bool,
    allow_partial_reservation: bool,
    auto_reserve_stock_for_sales_order_on_purchase: bool,
    auto_reserve_serial_and_batch_nos: bool,
    auto_create_serial_and_batch_bundle_for_outward: bool,
    pick_serial_batch_based_on: String,
    disable_serial_no_and_batch_selector: bool,
    have_default_naming_series_for_batch_id: bool,
    use_serial_batch_fields: bool,
    do_not_update_serial_batch_on_creation_of_auto_bundle: bool,
    allow_existing_serial_no_to_be_received_again: bool,
    set_bundle_naming_based_on_naming_series: bool,
    raise_material_request_when_stock_reaches_reorder_level: bool,
    notify_by_email_on_creation_of_automatic_material_request: bool,
    allow_material_transfer_from_delivery_note_to_sales_invoice: bool,
    allow_material_transfer_from_purchase_receipt_to_purchase_invoice: bool,
    freeze_stocks_older_than_days: i32,
    version: i64,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockSettingsResponse {
    ok: bool,
    data: StockSettingsView,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct MoneyAmountView {
    amount: i64,
    currency: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockWorkspaceMetricsView {
    total_stock_value: MoneyAmountView,
    total_warehouses: i64,
    total_active_items: i64,
    last_synced_at: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockWorkspaceMetricsResponse {
    ok: bool,
    data: StockWorkspaceMetricsView,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockWarehouseValuePoint {
    warehouse_id: String,
    warehouse_name: String,
    stock_value: MoneyAmountView,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockWarehouseValueView {
    last_synced_at: String,
    series: Vec<StockWarehouseValuePoint>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockWarehouseValueResponse {
    ok: bool,
    data: StockWarehouseValueView,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockQuickAccessView {
    items_available: i64,
    delivery_note_to_bill: i64,
    material_request_pending: i64,
    purchase_receipt_to_bill: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockQuickAccessResponse {
    ok: bool,
    data: StockQuickAccessView,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockListItemView {
    id: String,
    item_name: String,
    status: String,
    item_group: Option<String>,
    item_code: String,
    updated_at: String,
    has_variants: bool,
    variant_of: Option<String>,
    assigned_to: Option<String>,
    created_by: Option<String>,
    tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockItemsListData {
    total: i64,
    page: i64,
    page_size: i64,
    items: Vec<StockListItemView>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockItemsListResponse {
    ok: bool,
    data: StockItemsListData,
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
struct StockItemsQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    id: Option<String>,
    query: Option<String>,
    item_group: Option<String>,
    has_variants: Option<bool>,
    variant_of: Option<String>,
    assigned_to: Option<String>,
    created_by: Option<String>,
    tags: Option<String>,
    sort: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockSettingsCommentView {
    id: String,
    user_id: String,
    comment: String,
    created_at: String,
    updated_at: String,
    is_edited: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockSettingsCommentsData {
    rows: Vec<StockSettingsCommentView>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockSettingsCommentsResponse {
    ok: bool,
    data: StockSettingsCommentsData,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockSettingsCommentResponse {
    ok: bool,
    data: StockSettingsCommentView,
}

#[derive(Debug, Deserialize, ToSchema)]
struct StockSettingsCommentCreateRequest {
    comment: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockSettingsActivityView {
    id: String,
    r#type: String,
    message: String,
    actor_user_id: Option<String>,
    created_at: String,
    metadata: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockSettingsActivityData {
    rows: Vec<StockSettingsActivityView>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct StockSettingsActivityResponse {
    ok: bool,
    data: StockSettingsActivityData,
}

#[derive(Debug, Deserialize, ToSchema)]
struct StockSettingsPatchRequest {
    item_naming_by: Option<String>,
    default_warehouse_id: Option<String>,
    default_stock_uom_id: Option<String>,
    default_valuation_method: Option<String>,
    auto_insert_item_price_if_missing: Option<bool>,
    update_existing_price_list_rate: Option<bool>,
    allow_edit_stock_uom_qty_sales_docs: Option<bool>,
    allow_edit_stock_uom_qty_purchase_docs: Option<bool>,
    over_delivery_receipt_allowance_pct: Option<f64>,
    over_transfer_allowance_pct: Option<f64>,
    over_picking_allowance_pct: Option<f64>,
    allow_negative_stock: Option<bool>,
    show_barcode_field_in_stock_transactions: Option<bool>,
    convert_item_description_to_clean_html: Option<bool>,
    allow_internal_transfers_at_arms_length_price: Option<bool>,
    qi_action_if_not_submitted: Option<String>,
    qi_action_if_rejected: Option<String>,
    enable_stock_reservation: Option<bool>,
    allow_partial_reservation: Option<bool>,
    auto_reserve_stock_for_sales_order_on_purchase: Option<bool>,
    auto_reserve_serial_and_batch_nos: Option<bool>,
    auto_create_serial_and_batch_bundle_for_outward: Option<bool>,
    pick_serial_batch_based_on: Option<String>,
    disable_serial_no_and_batch_selector: Option<bool>,
    have_default_naming_series_for_batch_id: Option<bool>,
    use_serial_batch_fields: Option<bool>,
    do_not_update_serial_batch_on_creation_of_auto_bundle: Option<bool>,
    allow_existing_serial_no_to_be_received_again: Option<bool>,
    set_bundle_naming_based_on_naming_series: Option<bool>,
    raise_material_request_when_stock_reaches_reorder_level: Option<bool>,
    notify_by_email_on_creation_of_automatic_material_request: Option<bool>,
    allow_material_transfer_from_delivery_note_to_sales_invoice: Option<bool>,
    allow_material_transfer_from_purchase_receipt_to_purchase_invoice: Option<bool>,
    freeze_stocks_older_than_days: Option<i32>,
    version: Option<i64>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct StockSettingsPutRequest {
    item_naming_by: String,
    default_warehouse_id: Option<String>,
    default_stock_uom_id: Option<String>,
    default_valuation_method: String,
    auto_insert_item_price_if_missing: bool,
    update_existing_price_list_rate: bool,
    allow_edit_stock_uom_qty_sales_docs: bool,
    allow_edit_stock_uom_qty_purchase_docs: bool,
    over_delivery_receipt_allowance_pct: f64,
    over_transfer_allowance_pct: f64,
    over_picking_allowance_pct: f64,
    allow_negative_stock: bool,
    show_barcode_field_in_stock_transactions: bool,
    convert_item_description_to_clean_html: bool,
    allow_internal_transfers_at_arms_length_price: bool,
    qi_action_if_not_submitted: String,
    qi_action_if_rejected: String,
    enable_stock_reservation: bool,
    allow_partial_reservation: bool,
    auto_reserve_stock_for_sales_order_on_purchase: bool,
    auto_reserve_serial_and_batch_nos: bool,
    auto_create_serial_and_batch_bundle_for_outward: bool,
    pick_serial_batch_based_on: String,
    disable_serial_no_and_batch_selector: bool,
    have_default_naming_series_for_batch_id: bool,
    use_serial_batch_fields: bool,
    do_not_update_serial_batch_on_creation_of_auto_bundle: bool,
    allow_existing_serial_no_to_be_received_again: bool,
    set_bundle_naming_based_on_naming_series: bool,
    raise_material_request_when_stock_reaches_reorder_level: bool,
    notify_by_email_on_creation_of_automatic_material_request: bool,
    allow_material_transfer_from_delivery_note_to_sales_invoice: bool,
    allow_material_transfer_from_purchase_receipt_to_purchase_invoice: bool,
    freeze_stocks_older_than_days: i32,
    version: Option<i64>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct InventoryWarehouseAddressInput {
    line1: Option<String>,
    line2: Option<String>,
    city: Option<String>,
    state: Option<String>,
    #[serde(rename = "postalCode")]
    postal_code: Option<String>,
    country: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct CreateInventoryWarehouseRequest {
    code: String,
    name: String,
    description: Option<String>,
    #[serde(rename = "parentWarehouseId")]
    parent_warehouse_id: Option<String>,
    address: Option<InventoryWarehouseAddressInput>,
    #[serde(rename = "isActive")]
    is_active: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct UpdateInventoryWarehouseRequest {
    code: Option<String>,
    name: Option<String>,
    description: Option<String>,
    #[serde(rename = "parentWarehouseId")]
    parent_warehouse_id: Option<String>,
    address: Option<InventoryWarehouseAddressInput>,
    #[serde(rename = "isActive")]
    is_active: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct CreateInventoryLocationRequest {
    #[serde(rename = "warehouseId")]
    warehouse_id: String,
    #[serde(rename = "parentId")]
    parent_id: Option<String>,
    code: String,
    name: String,
    path: Option<String>,
    #[serde(rename = "isActive")]
    is_active: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct UpdateInventoryLocationRequest {
    #[serde(rename = "warehouseId")]
    warehouse_id: Option<String>,
    #[serde(rename = "parentId")]
    parent_id: Option<String>,
    code: Option<String>,
    name: Option<String>,
    path: Option<String>,
    #[serde(rename = "isActive")]
    is_active: Option<bool>,
}

#[derive(Debug, Clone)]
struct InventoryRequestContext {
    company_id: String,
    tenant_id: String,
    user_id: String,
    request_id: String,
    role: String,
    user_level: i32,
    #[allow(dead_code)]
    permissions: Vec<String>,
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

#[derive(Debug, FromRow)]
struct InventoryWarehouseDbRow {
    id: String,
    code: String,
    name: String,
    description: Option<String>,
    parent_warehouse_id: Option<String>,
    parent_warehouse_code: Option<String>,
    parent_warehouse_name: Option<String>,
    address: Option<Value>,
    is_active: bool,
}

#[derive(Debug, FromRow)]
struct InventoryLocationDbRow {
    id: String,
    warehouse_id: String,
    code: String,
    name: String,
    is_active: bool,
}

#[derive(Debug, FromRow, Clone)]
struct StockSettingsDbRow {
    item_naming_by: String,
    default_warehouse_id: Option<String>,
    default_stock_uom_id: Option<String>,
    default_valuation_method: String,
    auto_insert_item_price_if_missing: bool,
    update_existing_price_list_rate: bool,
    allow_edit_stock_uom_qty_sales_docs: bool,
    allow_edit_stock_uom_qty_purchase_docs: bool,
    over_delivery_receipt_allowance_pct: f64,
    over_transfer_allowance_pct: f64,
    over_picking_allowance_pct: f64,
    allow_negative_stock: bool,
    show_barcode_field_in_stock_transactions: bool,
    convert_item_description_to_clean_html: bool,
    allow_internal_transfers_at_arms_length_price: bool,
    qi_action_if_not_submitted: String,
    qi_action_if_rejected: String,
    enable_stock_reservation: bool,
    allow_partial_reservation: bool,
    auto_reserve_stock_for_sales_order_on_purchase: bool,
    auto_reserve_serial_and_batch_nos: bool,
    auto_create_serial_and_batch_bundle_for_outward: bool,
    pick_serial_batch_based_on: String,
    disable_serial_no_and_batch_selector: bool,
    have_default_naming_series_for_batch_id: bool,
    use_serial_batch_fields: bool,
    do_not_update_serial_batch_on_creation_of_auto_bundle: bool,
    allow_existing_serial_no_to_be_received_again: bool,
    set_bundle_naming_based_on_naming_series: bool,
    raise_material_request_when_stock_reaches_reorder_level: bool,
    notify_by_email_on_creation_of_automatic_material_request: bool,
    allow_material_transfer_from_delivery_note_to_sales_invoice: bool,
    allow_material_transfer_pr_to_pi: bool,
    freeze_stocks_older_than_days: i32,
    version: i64,
    updated_at: NaiveDateTime,
}

#[derive(Debug, FromRow)]
struct WorkspaceMetricsDbRow {
    total_stock_value: i64,
    total_warehouses: i64,
    total_active_items: i64,
    last_synced_at: NaiveDateTime,
}

#[derive(Debug, FromRow)]
struct WarehouseStockValueDbRow {
    warehouse_id: String,
    warehouse_name: String,
    stock_value: i64,
}

#[derive(Debug, FromRow)]
struct StockItemsDbRow {
    id: String,
    item_name: String,
    status: String,
    item_group: Option<String>,
    item_code: String,
    updated_at: NaiveDateTime,
    has_variants: bool,
    variant_of: Option<String>,
    assigned_to: Option<String>,
    created_by: Option<String>,
}

#[derive(Debug, FromRow)]
struct ItemTagDbRow {
    item_id: String,
    tag: String,
}

#[derive(Debug, FromRow)]
struct StockSettingsCommentDbRow {
    id: String,
    user_id: String,
    comment: String,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    is_edited: bool,
}

#[derive(Debug, FromRow)]
struct StockSettingsActivityDbRow {
    id: String,
    entry_type: String,
    message: String,
    actor_user_id: Option<String>,
    created_at: NaiveDateTime,
    metadata: Option<Value>,
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

fn api_error_with_details(
    status: StatusCode,
    code: &str,
    message: impl Into<String>,
    details: Value,
) -> (StatusCode, Json<ErrorEnvelope>) {
    (
        status,
        Json(ErrorEnvelope {
            ok: false,
            error: ApiErrorBody {
                code: code.to_string(),
                message: message.into(),
                details: Some(details),
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

fn parse_permissions(headers: &HeaderMap) -> Vec<String> {
    header_value(headers, "x-minierp-permissions")
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn normalize_sku(raw: &str) -> String {
    raw.split_whitespace()
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase()
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_required_text(value: &str) -> Option<String> {
    normalize_optional_text(Some(value))
}

fn address_to_json(address: &InventoryWarehouseAddressInput) -> Value {
    json!({
        "line1": normalize_optional_text(address.line1.as_deref()),
        "line2": normalize_optional_text(address.line2.as_deref()),
        "city": normalize_optional_text(address.city.as_deref()),
        "state": normalize_optional_text(address.state.as_deref()),
        "postalCode": normalize_optional_text(address.postal_code.as_deref()),
        "country": normalize_optional_text(address.country.as_deref()),
    })
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

fn map_warehouse(
    row: &InventoryWarehouseDbRow,
    locations: Vec<InventoryLocationView>,
) -> InventoryWarehouseView {
    InventoryWarehouseView {
        id: row.id.clone(),
        code: row.code.clone(),
        name: row.name.clone(),
        description: row.description.clone(),
        parent_warehouse: row
            .parent_warehouse_id
            .as_ref()
            .map(|id| InventoryWarehouseParentRef {
                id: id.clone(),
                code: row.parent_warehouse_code.clone().unwrap_or_default(),
                name: row.parent_warehouse_name.clone().unwrap_or_default(),
            }),
        address: row.address.clone().unwrap_or_else(|| json!({})),
        is_active: row.is_active,
        locations,
    }
}

fn has_stock_settings_write_permission(ctx: &InventoryRequestContext) -> bool {
    ctx.user_level >= 4
}

fn sanitize_optional_query(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_sort(sort: Option<&str>) -> &'static str {
    match sort.unwrap_or("last_updated_desc").trim() {
        "name_asc" => "name_asc",
        "name_desc" => "name_desc",
        _ => "last_updated_desc",
    }
}

fn parse_user_level(headers: &HeaderMap) -> i32 {
    header_value(headers, "x-minierp-user-level")
        .and_then(|raw| raw.parse::<i32>().ok())
        .filter(|value| [2, 3, 4, 5, 9].contains(value))
        .unwrap_or(3)
}

fn parse_if_match(headers: &HeaderMap) -> Option<i64> {
    header_value(headers, "if-match")
        .map(|raw| raw.trim_matches('"').trim().to_string())
        .and_then(|raw| raw.parse::<i64>().ok())
}

fn normalize_optional_owned(value: Option<String>) -> Option<String> {
    value.and_then(|raw| normalize_optional_text(Some(raw.as_str())))
}

fn format_timestamp(value: NaiveDateTime) -> String {
    format!("{}Z", value.format("%Y-%m-%dT%H:%M:%S%.3f"))
}

fn validate_enum(value: &str, allowed: &[&str], field: &str) -> Result<(), String> {
    if allowed.contains(&value) {
        return Ok(());
    }
    Err(format!("{field} must be one of {}", allowed.join(", ")))
}

fn validate_stock_settings(view: &StockSettingsView) -> Result<(), Vec<String>> {
    let mut errors: Vec<String> = Vec::new();

    if !(0.0..=100.0).contains(&view.over_delivery_receipt_allowance_pct) {
        errors.push("over_delivery_receipt_allowance_pct must be between 0 and 100".to_string());
    }
    if !(0.0..=100.0).contains(&view.over_transfer_allowance_pct) {
        errors.push("over_transfer_allowance_pct must be between 0 and 100".to_string());
    }
    if !(0.0..=100.0).contains(&view.over_picking_allowance_pct) {
        errors.push("over_picking_allowance_pct must be between 0 and 100".to_string());
    }
    if view.freeze_stocks_older_than_days < 0 {
        errors.push("freeze_stocks_older_than_days must be >= 0".to_string());
    }

    if let Err(err) = validate_enum(
        &view.item_naming_by,
        &["ITEM_CODE", "NAMING_SERIES"],
        "item_naming_by",
    ) {
        errors.push(err);
    }
    if let Err(err) = validate_enum(
        &view.default_valuation_method,
        &["FIFO", "MOVING_AVERAGE"],
        "default_valuation_method",
    ) {
        errors.push(err);
    }
    if let Err(err) = validate_enum(
        &view.qi_action_if_not_submitted,
        &["STOP", "WARN", "ALLOW"],
        "qi_action_if_not_submitted",
    ) {
        errors.push(err);
    }
    if let Err(err) = validate_enum(
        &view.qi_action_if_rejected,
        &["STOP", "WARN", "ALLOW"],
        "qi_action_if_rejected",
    ) {
        errors.push(err);
    }
    if let Err(err) = validate_enum(
        &view.pick_serial_batch_based_on,
        &["FIFO", "LIFO", "EXPIRY"],
        "pick_serial_batch_based_on",
    ) {
        errors.push(err);
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

fn row_to_stock_settings(row: &StockSettingsDbRow) -> StockSettingsView {
    StockSettingsView {
        item_naming_by: row.item_naming_by.clone(),
        default_warehouse_id: row.default_warehouse_id.clone(),
        default_stock_uom_id: row.default_stock_uom_id.clone(),
        default_valuation_method: row.default_valuation_method.clone(),
        auto_insert_item_price_if_missing: row.auto_insert_item_price_if_missing,
        update_existing_price_list_rate: row.update_existing_price_list_rate,
        allow_edit_stock_uom_qty_sales_docs: row.allow_edit_stock_uom_qty_sales_docs,
        allow_edit_stock_uom_qty_purchase_docs: row.allow_edit_stock_uom_qty_purchase_docs,
        over_delivery_receipt_allowance_pct: row.over_delivery_receipt_allowance_pct,
        over_transfer_allowance_pct: row.over_transfer_allowance_pct,
        over_picking_allowance_pct: row.over_picking_allowance_pct,
        allow_negative_stock: row.allow_negative_stock,
        show_barcode_field_in_stock_transactions: row.show_barcode_field_in_stock_transactions,
        convert_item_description_to_clean_html: row.convert_item_description_to_clean_html,
        allow_internal_transfers_at_arms_length_price: row
            .allow_internal_transfers_at_arms_length_price,
        qi_action_if_not_submitted: row.qi_action_if_not_submitted.clone(),
        qi_action_if_rejected: row.qi_action_if_rejected.clone(),
        enable_stock_reservation: row.enable_stock_reservation,
        allow_partial_reservation: row.allow_partial_reservation,
        auto_reserve_stock_for_sales_order_on_purchase: row
            .auto_reserve_stock_for_sales_order_on_purchase,
        auto_reserve_serial_and_batch_nos: row.auto_reserve_serial_and_batch_nos,
        auto_create_serial_and_batch_bundle_for_outward: row
            .auto_create_serial_and_batch_bundle_for_outward,
        pick_serial_batch_based_on: row.pick_serial_batch_based_on.clone(),
        disable_serial_no_and_batch_selector: row.disable_serial_no_and_batch_selector,
        have_default_naming_series_for_batch_id: row.have_default_naming_series_for_batch_id,
        use_serial_batch_fields: row.use_serial_batch_fields,
        do_not_update_serial_batch_on_creation_of_auto_bundle: row
            .do_not_update_serial_batch_on_creation_of_auto_bundle,
        allow_existing_serial_no_to_be_received_again: row
            .allow_existing_serial_no_to_be_received_again,
        set_bundle_naming_based_on_naming_series: row.set_bundle_naming_based_on_naming_series,
        raise_material_request_when_stock_reaches_reorder_level: row
            .raise_material_request_when_stock_reaches_reorder_level,
        notify_by_email_on_creation_of_automatic_material_request: row
            .notify_by_email_on_creation_of_automatic_material_request,
        allow_material_transfer_from_delivery_note_to_sales_invoice: row
            .allow_material_transfer_from_delivery_note_to_sales_invoice,
        allow_material_transfer_from_purchase_receipt_to_purchase_invoice: row
            .allow_material_transfer_pr_to_pi,
        freeze_stocks_older_than_days: row.freeze_stocks_older_than_days,
        version: row.version,
        updated_at: format_timestamp(row.updated_at),
    }
}

fn merge_patch_into_stock_settings(
    current: &StockSettingsView,
    patch: StockSettingsPatchRequest,
) -> StockSettingsView {
    StockSettingsView {
        item_naming_by: patch
            .item_naming_by
            .unwrap_or_else(|| current.item_naming_by.clone()),
        default_warehouse_id: match patch.default_warehouse_id {
            Some(raw) => normalize_optional_text(Some(raw.as_str())),
            None => current.default_warehouse_id.clone(),
        },
        default_stock_uom_id: match patch.default_stock_uom_id {
            Some(raw) => normalize_optional_text(Some(raw.as_str())),
            None => current.default_stock_uom_id.clone(),
        },
        default_valuation_method: patch
            .default_valuation_method
            .unwrap_or_else(|| current.default_valuation_method.clone()),
        auto_insert_item_price_if_missing: patch
            .auto_insert_item_price_if_missing
            .unwrap_or(current.auto_insert_item_price_if_missing),
        update_existing_price_list_rate: patch
            .update_existing_price_list_rate
            .unwrap_or(current.update_existing_price_list_rate),
        allow_edit_stock_uom_qty_sales_docs: patch
            .allow_edit_stock_uom_qty_sales_docs
            .unwrap_or(current.allow_edit_stock_uom_qty_sales_docs),
        allow_edit_stock_uom_qty_purchase_docs: patch
            .allow_edit_stock_uom_qty_purchase_docs
            .unwrap_or(current.allow_edit_stock_uom_qty_purchase_docs),
        over_delivery_receipt_allowance_pct: patch
            .over_delivery_receipt_allowance_pct
            .unwrap_or(current.over_delivery_receipt_allowance_pct),
        over_transfer_allowance_pct: patch
            .over_transfer_allowance_pct
            .unwrap_or(current.over_transfer_allowance_pct),
        over_picking_allowance_pct: patch
            .over_picking_allowance_pct
            .unwrap_or(current.over_picking_allowance_pct),
        allow_negative_stock: patch
            .allow_negative_stock
            .unwrap_or(current.allow_negative_stock),
        show_barcode_field_in_stock_transactions: patch
            .show_barcode_field_in_stock_transactions
            .unwrap_or(current.show_barcode_field_in_stock_transactions),
        convert_item_description_to_clean_html: patch
            .convert_item_description_to_clean_html
            .unwrap_or(current.convert_item_description_to_clean_html),
        allow_internal_transfers_at_arms_length_price: patch
            .allow_internal_transfers_at_arms_length_price
            .unwrap_or(current.allow_internal_transfers_at_arms_length_price),
        qi_action_if_not_submitted: patch
            .qi_action_if_not_submitted
            .unwrap_or_else(|| current.qi_action_if_not_submitted.clone()),
        qi_action_if_rejected: patch
            .qi_action_if_rejected
            .unwrap_or_else(|| current.qi_action_if_rejected.clone()),
        enable_stock_reservation: patch
            .enable_stock_reservation
            .unwrap_or(current.enable_stock_reservation),
        allow_partial_reservation: patch
            .allow_partial_reservation
            .unwrap_or(current.allow_partial_reservation),
        auto_reserve_stock_for_sales_order_on_purchase: patch
            .auto_reserve_stock_for_sales_order_on_purchase
            .unwrap_or(current.auto_reserve_stock_for_sales_order_on_purchase),
        auto_reserve_serial_and_batch_nos: patch
            .auto_reserve_serial_and_batch_nos
            .unwrap_or(current.auto_reserve_serial_and_batch_nos),
        auto_create_serial_and_batch_bundle_for_outward: patch
            .auto_create_serial_and_batch_bundle_for_outward
            .unwrap_or(current.auto_create_serial_and_batch_bundle_for_outward),
        pick_serial_batch_based_on: patch
            .pick_serial_batch_based_on
            .unwrap_or_else(|| current.pick_serial_batch_based_on.clone()),
        disable_serial_no_and_batch_selector: patch
            .disable_serial_no_and_batch_selector
            .unwrap_or(current.disable_serial_no_and_batch_selector),
        have_default_naming_series_for_batch_id: patch
            .have_default_naming_series_for_batch_id
            .unwrap_or(current.have_default_naming_series_for_batch_id),
        use_serial_batch_fields: patch
            .use_serial_batch_fields
            .unwrap_or(current.use_serial_batch_fields),
        do_not_update_serial_batch_on_creation_of_auto_bundle: patch
            .do_not_update_serial_batch_on_creation_of_auto_bundle
            .unwrap_or(current.do_not_update_serial_batch_on_creation_of_auto_bundle),
        allow_existing_serial_no_to_be_received_again: patch
            .allow_existing_serial_no_to_be_received_again
            .unwrap_or(current.allow_existing_serial_no_to_be_received_again),
        set_bundle_naming_based_on_naming_series: patch
            .set_bundle_naming_based_on_naming_series
            .unwrap_or(current.set_bundle_naming_based_on_naming_series),
        raise_material_request_when_stock_reaches_reorder_level: patch
            .raise_material_request_when_stock_reaches_reorder_level
            .unwrap_or(current.raise_material_request_when_stock_reaches_reorder_level),
        notify_by_email_on_creation_of_automatic_material_request: patch
            .notify_by_email_on_creation_of_automatic_material_request
            .unwrap_or(current.notify_by_email_on_creation_of_automatic_material_request),
        allow_material_transfer_from_delivery_note_to_sales_invoice: patch
            .allow_material_transfer_from_delivery_note_to_sales_invoice
            .unwrap_or(current.allow_material_transfer_from_delivery_note_to_sales_invoice),
        allow_material_transfer_from_purchase_receipt_to_purchase_invoice: patch
            .allow_material_transfer_from_purchase_receipt_to_purchase_invoice
            .unwrap_or(current.allow_material_transfer_from_purchase_receipt_to_purchase_invoice),
        freeze_stocks_older_than_days: patch
            .freeze_stocks_older_than_days
            .unwrap_or(current.freeze_stocks_older_than_days),
        version: current.version,
        updated_at: current.updated_at.clone(),
    }
}

async fn fetch_stock_settings_row(
    pool: &PgPool,
    company_id: &str,
) -> Result<Option<StockSettingsDbRow>, sqlx::Error> {
    sqlx::query_as::<_, StockSettingsDbRow>(
        r#"
        SELECT
          "itemNamingBy"::text AS item_naming_by,
          "defaultWarehouseId" AS default_warehouse_id,
          "defaultStockUomId" AS default_stock_uom_id,
          "defaultValuationMethod"::text AS default_valuation_method,
          "autoInsertItemPriceIfMissing" AS auto_insert_item_price_if_missing,
          "updateExistingPriceListRate" AS update_existing_price_list_rate,
          "allowEditStockUomQtySalesDocs" AS allow_edit_stock_uom_qty_sales_docs,
          "allowEditStockUomQtyPurchaseDocs" AS allow_edit_stock_uom_qty_purchase_docs,
          "overDeliveryReceiptAllowancePct"::double precision AS over_delivery_receipt_allowance_pct,
          "overTransferAllowancePct"::double precision AS over_transfer_allowance_pct,
          "overPickingAllowancePct"::double precision AS over_picking_allowance_pct,
          "allowNegativeStock" AS allow_negative_stock,
          "showBarcodeFieldInStockTransactions" AS show_barcode_field_in_stock_transactions,
          "convertItemDescriptionToCleanHtml" AS convert_item_description_to_clean_html,
          "allowInternalTransfersAtArmsLengthPrice" AS allow_internal_transfers_at_arms_length_price,
          "qiActionIfNotSubmitted"::text AS qi_action_if_not_submitted,
          "qiActionIfRejected"::text AS qi_action_if_rejected,
          "enableStockReservation" AS enable_stock_reservation,
          "allowPartialReservation" AS allow_partial_reservation,
          "autoReserveStockForSalesOrderOnPurchase" AS auto_reserve_stock_for_sales_order_on_purchase,
          "autoReserveSerialAndBatchNos" AS auto_reserve_serial_and_batch_nos,
          "autoCreateSerialAndBatchBundleForOutward" AS auto_create_serial_and_batch_bundle_for_outward,
          "pickSerialBatchBasedOn"::text AS pick_serial_batch_based_on,
          "disableSerialNoAndBatchSelector" AS disable_serial_no_and_batch_selector,
          "haveDefaultNamingSeriesForBatchId" AS have_default_naming_series_for_batch_id,
          "useSerialBatchFields" AS use_serial_batch_fields,
          "doNotUpdateSerialBatchOnCreationOfAutoBundle" AS do_not_update_serial_batch_on_creation_of_auto_bundle,
          "allowExistingSerialNoToBeReceivedAgain" AS allow_existing_serial_no_to_be_received_again,
          "setBundleNamingBasedOnNamingSeries" AS set_bundle_naming_based_on_naming_series,
          "raiseMaterialRequestWhenStockReachesReorderLevel" AS raise_material_request_when_stock_reaches_reorder_level,
          "notifyByEmailOnCreationOfAutomaticMaterialRequest" AS notify_by_email_on_creation_of_automatic_material_request,
          "allowMaterialTransferFromDeliveryNoteToSalesInvoice" AS allow_material_transfer_from_delivery_note_to_sales_invoice,
          "allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice" AS allow_material_transfer_pr_to_pi,
          "freezeStocksOlderThanDays" AS freeze_stocks_older_than_days,
          "version"::bigint AS version,
          "updatedAt" AS updated_at
        FROM "InventoryCompanySetting"
        WHERE "orgId" = $1
        LIMIT 1
        "#,
    )
    .bind(company_id)
    .fetch_optional(pool)
    .await
}

async fn get_or_create_stock_settings_row(
    pool: &PgPool,
    company_id: &str,
    user_id: &str,
) -> Result<StockSettingsDbRow, sqlx::Error> {
    if let Some(row) = fetch_stock_settings_row(pool, company_id).await? {
        return Ok(row);
    }

    sqlx::query(
        r#"
        INSERT INTO "InventoryCompanySetting" ("id", "orgId", "updatedBy", "updatedAt")
        VALUES (md5(random()::text || clock_timestamp()::text), $1, $2, NOW())
        ON CONFLICT ("orgId") DO NOTHING
        "#,
    )
    .bind(company_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    fetch_stock_settings_row(pool, company_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

async fn update_stock_settings_row(
    pool: &PgPool,
    company_id: &str,
    user_id: &str,
    expected_version: i64,
    next: &StockSettingsView,
) -> Result<Option<StockSettingsDbRow>, sqlx::Error> {
    sqlx::query_as::<_, StockSettingsDbRow>(
        r#"
        UPDATE "InventoryCompanySetting"
        SET
          "itemNamingBy" = $3::"InventoryItemNamingBy",
          "defaultWarehouseId" = $4,
          "defaultStockUomId" = $5,
          "defaultValuationMethod" = $6::"InventoryValuationMethod",
          "autoInsertItemPriceIfMissing" = $7,
          "updateExistingPriceListRate" = $8,
          "allowEditStockUomQtySalesDocs" = $9,
          "allowEditStockUomQtyPurchaseDocs" = $10,
          "overDeliveryReceiptAllowancePct" = $11::numeric,
          "overTransferAllowancePct" = $12::numeric,
          "overPickingAllowancePct" = $13::numeric,
          "allowNegativeStock" = $14,
          "showBarcodeFieldInStockTransactions" = $15,
          "convertItemDescriptionToCleanHtml" = $16,
          "allowInternalTransfersAtArmsLengthPrice" = $17,
          "qiActionIfNotSubmitted" = $18::"InventoryQiAction",
          "qiActionIfRejected" = $19::"InventoryQiAction",
          "enableStockReservation" = $20,
          "allowPartialReservation" = $21,
          "autoReserveStockForSalesOrderOnPurchase" = $22,
          "autoReserveSerialAndBatchNos" = $23,
          "autoCreateSerialAndBatchBundleForOutward" = $24,
          "pickSerialBatchBasedOn" = $25::"InventorySerialBatchPickBasis",
          "disableSerialNoAndBatchSelector" = $26,
          "haveDefaultNamingSeriesForBatchId" = $27,
          "useSerialBatchFields" = $28,
          "doNotUpdateSerialBatchOnCreationOfAutoBundle" = $29,
          "allowExistingSerialNoToBeReceivedAgain" = $30,
          "setBundleNamingBasedOnNamingSeries" = $31,
          "raiseMaterialRequestWhenStockReachesReorderLevel" = $32,
          "notifyByEmailOnCreationOfAutomaticMaterialRequest" = $33,
          "allowMaterialTransferFromDeliveryNoteToSalesInvoice" = $34,
          "allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice" = $35,
          "freezeStocksOlderThanDays" = $36,
          "version" = "version" + 1,
          "updatedBy" = $37,
          "costingMethod" = CASE WHEN $6 = 'FIFO' THEN 'FIFO' ELSE 'AVG' END,
          "preventNegativeStock" = NOT $14,
          "updatedAt" = NOW()
        WHERE "orgId" = $1
          AND "version" = $2::integer
        RETURNING
          "itemNamingBy"::text AS item_naming_by,
          "defaultWarehouseId" AS default_warehouse_id,
          "defaultStockUomId" AS default_stock_uom_id,
          "defaultValuationMethod"::text AS default_valuation_method,
          "autoInsertItemPriceIfMissing" AS auto_insert_item_price_if_missing,
          "updateExistingPriceListRate" AS update_existing_price_list_rate,
          "allowEditStockUomQtySalesDocs" AS allow_edit_stock_uom_qty_sales_docs,
          "allowEditStockUomQtyPurchaseDocs" AS allow_edit_stock_uom_qty_purchase_docs,
          "overDeliveryReceiptAllowancePct"::double precision AS over_delivery_receipt_allowance_pct,
          "overTransferAllowancePct"::double precision AS over_transfer_allowance_pct,
          "overPickingAllowancePct"::double precision AS over_picking_allowance_pct,
          "allowNegativeStock" AS allow_negative_stock,
          "showBarcodeFieldInStockTransactions" AS show_barcode_field_in_stock_transactions,
          "convertItemDescriptionToCleanHtml" AS convert_item_description_to_clean_html,
          "allowInternalTransfersAtArmsLengthPrice" AS allow_internal_transfers_at_arms_length_price,
          "qiActionIfNotSubmitted"::text AS qi_action_if_not_submitted,
          "qiActionIfRejected"::text AS qi_action_if_rejected,
          "enableStockReservation" AS enable_stock_reservation,
          "allowPartialReservation" AS allow_partial_reservation,
          "autoReserveStockForSalesOrderOnPurchase" AS auto_reserve_stock_for_sales_order_on_purchase,
          "autoReserveSerialAndBatchNos" AS auto_reserve_serial_and_batch_nos,
          "autoCreateSerialAndBatchBundleForOutward" AS auto_create_serial_and_batch_bundle_for_outward,
          "pickSerialBatchBasedOn"::text AS pick_serial_batch_based_on,
          "disableSerialNoAndBatchSelector" AS disable_serial_no_and_batch_selector,
          "haveDefaultNamingSeriesForBatchId" AS have_default_naming_series_for_batch_id,
          "useSerialBatchFields" AS use_serial_batch_fields,
          "doNotUpdateSerialBatchOnCreationOfAutoBundle" AS do_not_update_serial_batch_on_creation_of_auto_bundle,
          "allowExistingSerialNoToBeReceivedAgain" AS allow_existing_serial_no_to_be_received_again,
          "setBundleNamingBasedOnNamingSeries" AS set_bundle_naming_based_on_naming_series,
          "raiseMaterialRequestWhenStockReachesReorderLevel" AS raise_material_request_when_stock_reaches_reorder_level,
          "notifyByEmailOnCreationOfAutomaticMaterialRequest" AS notify_by_email_on_creation_of_automatic_material_request,
          "allowMaterialTransferFromDeliveryNoteToSalesInvoice" AS allow_material_transfer_from_delivery_note_to_sales_invoice,
          "allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice" AS allow_material_transfer_pr_to_pi,
          "freezeStocksOlderThanDays" AS freeze_stocks_older_than_days,
          "version"::bigint AS version,
          "updatedAt" AS updated_at
        "#,
    )
    .bind(company_id)
    .bind(expected_version)
    .bind(&next.item_naming_by)
    .bind(next.default_warehouse_id.as_deref())
    .bind(next.default_stock_uom_id.as_deref())
    .bind(&next.default_valuation_method)
    .bind(next.auto_insert_item_price_if_missing)
    .bind(next.update_existing_price_list_rate)
    .bind(next.allow_edit_stock_uom_qty_sales_docs)
    .bind(next.allow_edit_stock_uom_qty_purchase_docs)
    .bind(next.over_delivery_receipt_allowance_pct)
    .bind(next.over_transfer_allowance_pct)
    .bind(next.over_picking_allowance_pct)
    .bind(next.allow_negative_stock)
    .bind(next.show_barcode_field_in_stock_transactions)
    .bind(next.convert_item_description_to_clean_html)
    .bind(next.allow_internal_transfers_at_arms_length_price)
    .bind(&next.qi_action_if_not_submitted)
    .bind(&next.qi_action_if_rejected)
    .bind(next.enable_stock_reservation)
    .bind(next.allow_partial_reservation)
    .bind(next.auto_reserve_stock_for_sales_order_on_purchase)
    .bind(next.auto_reserve_serial_and_batch_nos)
    .bind(next.auto_create_serial_and_batch_bundle_for_outward)
    .bind(&next.pick_serial_batch_based_on)
    .bind(next.disable_serial_no_and_batch_selector)
    .bind(next.have_default_naming_series_for_batch_id)
    .bind(next.use_serial_batch_fields)
    .bind(next.do_not_update_serial_batch_on_creation_of_auto_bundle)
    .bind(next.allow_existing_serial_no_to_be_received_again)
    .bind(next.set_bundle_naming_based_on_naming_series)
    .bind(next.raise_material_request_when_stock_reaches_reorder_level)
    .bind(next.notify_by_email_on_creation_of_automatic_material_request)
    .bind(next.allow_material_transfer_from_delivery_note_to_sales_invoice)
    .bind(next.allow_material_transfer_from_purchase_receipt_to_purchase_invoice)
    .bind(next.freeze_stocks_older_than_days)
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

fn compute_stock_settings_diff(before: &StockSettingsView, after: &StockSettingsView) -> Value {
    let before_json = serde_json::to_value(before).unwrap_or_else(|_| json!({}));
    let after_json = serde_json::to_value(after).unwrap_or_else(|_| json!({}));
    let mut diff = serde_json::Map::new();

    let before_obj = before_json.as_object().cloned().unwrap_or_default();
    let after_obj = after_json.as_object().cloned().unwrap_or_default();

    for (key, after_value) in after_obj {
        let before_value = before_obj.get(&key);
        if before_value != Some(&after_value) {
            diff.insert(
                key,
                json!({
                    "before": before_value.cloned().unwrap_or(Value::Null),
                    "after": after_value,
                }),
            );
        }
    }

    Value::Object(diff)
}

async fn insert_stock_settings_audit(
    pool: &PgPool,
    ctx: &InventoryRequestContext,
    before: &StockSettingsView,
    after: &StockSettingsView,
) {
    let diff = compute_stock_settings_diff(before, after);
    let before_json = serde_json::to_value(before).unwrap_or_else(|_| json!({}));
    let after_json = serde_json::to_value(after).unwrap_or_else(|_| json!({}));

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO "InventoryAuditLog" (
          "id",
          "orgId",
          "actorUserId",
          "action",
          "entityType",
          "entityId",
          "before",
          "after",
          "diff",
          "requestId",
          "metadata",
          "createdAt"
        )
        VALUES (
          md5(random()::text || clock_timestamp()::text),
          $1,
          $2,
          'STOCK_SETTINGS_UPDATED',
          'InventoryCompanySetting',
          NULL,
          $3::jsonb,
          $4::jsonb,
          $5::jsonb,
          $6,
          $7::jsonb,
          NOW()
        )
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&ctx.user_id)
    .bind(SqlJson(before_json))
    .bind(SqlJson(after_json))
    .bind(SqlJson(diff))
    .bind(&ctx.request_id)
    .bind(SqlJson(json!({
        "source": "rust-api",
        "path": "/api/stock/settings",
        "role": ctx.role,
    })))
    .execute(pool)
    .await
    {
        warn!(error = %error, request_id = %ctx.request_id, "failed to write stock settings audit");
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
    let role =
        header_value(headers, "x-minierp-role").unwrap_or_else(|| "WAREHOUSE_OPERATOR".to_string());
    let user_level = parse_user_level(headers);
    let permissions = parse_permissions(headers);

    Ok(InventoryRequestContext {
        company_id,
        tenant_id,
        user_id,
        request_id,
        role,
        user_level,
        permissions,
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

async fn fetch_inventory_warehouse_rows(
    pool: &PgPool,
    company_id: &str,
) -> Result<Vec<InventoryWarehouseDbRow>, sqlx::Error> {
    sqlx::query_as::<_, InventoryWarehouseDbRow>(
        r#"
        SELECT
          w."id" AS id,
          w."code" AS code,
          w."name" AS name,
          w."description" AS description,
          w."parentWarehouseId" AS parent_warehouse_id,
          parent."code" AS parent_warehouse_code,
          parent."name" AS parent_warehouse_name,
          (w."metadata" -> 'address') AS address,
          w."isActive" AS is_active
        FROM "InventoryWarehouse" w
        LEFT JOIN "InventoryWarehouse" parent ON parent."id" = w."parentWarehouseId"
        WHERE w."orgId" = $1
        ORDER BY w."name" ASC
        "#,
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
}

async fn fetch_inventory_location_rows(
    pool: &PgPool,
    company_id: &str,
    warehouse_id: Option<&str>,
) -> Result<Vec<InventoryLocationDbRow>, sqlx::Error> {
    sqlx::query_as::<_, InventoryLocationDbRow>(
        r#"
        SELECT
          l."id" AS id,
          l."warehouseId" AS warehouse_id,
          l."code" AS code,
          l."name" AS name,
          l."isActive" AS is_active
        FROM "InventoryWarehouseLocation" l
        WHERE l."orgId" = $1
          AND ($2::text IS NULL OR l."warehouseId" = $2)
        ORDER BY l."warehouseId" ASC, l."path" ASC NULLS LAST, l."code" ASC
        "#,
    )
    .bind(company_id)
    .bind(warehouse_id)
    .fetch_all(pool)
    .await
}

async fn fetch_inventory_warehouses(
    pool: &PgPool,
    company_id: &str,
) -> Result<Vec<InventoryWarehouseView>, sqlx::Error> {
    let warehouse_rows = fetch_inventory_warehouse_rows(pool, company_id).await?;
    let location_rows = fetch_inventory_location_rows(pool, company_id, None).await?;

    let mut locations_by_warehouse: HashMap<String, Vec<InventoryLocationView>> = HashMap::new();
    for location in location_rows {
        locations_by_warehouse
            .entry(location.warehouse_id)
            .or_default()
            .push(InventoryLocationView {
                id: location.id,
                code: location.code,
                name: location.name,
                is_active: location.is_active,
            });
    }

    Ok(warehouse_rows
        .iter()
        .map(|row| {
            map_warehouse(
                row,
                locations_by_warehouse.remove(&row.id).unwrap_or_default(),
            )
        })
        .collect())
}

async fn fetch_inventory_warehouse_by_id(
    pool: &PgPool,
    company_id: &str,
    warehouse_id: &str,
) -> Result<Option<InventoryWarehouseView>, sqlx::Error> {
    let warehouse_row = sqlx::query_as::<_, InventoryWarehouseDbRow>(
        r#"
        SELECT
          w."id" AS id,
          w."code" AS code,
          w."name" AS name,
          w."description" AS description,
          w."parentWarehouseId" AS parent_warehouse_id,
          parent."code" AS parent_warehouse_code,
          parent."name" AS parent_warehouse_name,
          (w."metadata" -> 'address') AS address,
          w."isActive" AS is_active
        FROM "InventoryWarehouse" w
        LEFT JOIN "InventoryWarehouse" parent ON parent."id" = w."parentWarehouseId"
        WHERE w."orgId" = $1 AND w."id" = $2
        LIMIT 1
        "#,
    )
    .bind(company_id)
    .bind(warehouse_id)
    .fetch_optional(pool)
    .await?;

    let Some(row) = warehouse_row else {
        return Ok(None);
    };

    let location_rows = fetch_inventory_location_rows(pool, company_id, Some(warehouse_id)).await?;
    let locations = location_rows
        .into_iter()
        .map(|location| InventoryLocationView {
            id: location.id,
            code: location.code,
            name: location.name,
            is_active: location.is_active,
        })
        .collect();

    Ok(Some(map_warehouse(&row, locations)))
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
    path = "/api/stock/settings",
    tag = "inventory",
    responses(
        (status = 200, body = StockSettingsResponse),
        (status = 401, body = ErrorEnvelope),
        (status = 503, body = ErrorEnvelope)
    )
)]
async fn get_stock_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<StockSettingsResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let row = get_or_create_stock_settings_row(pool, &ctx.company_id, &ctx.user_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to load stock settings");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load stock settings",
            )
        })?;

    Ok(Json(StockSettingsResponse {
        ok: true,
        data: row_to_stock_settings(&row),
    }))
}

fn validate_and_build_put(payload: StockSettingsPutRequest) -> StockSettingsView {
    StockSettingsView {
        item_naming_by: payload.item_naming_by,
        default_warehouse_id: normalize_optional_owned(payload.default_warehouse_id),
        default_stock_uom_id: normalize_optional_owned(payload.default_stock_uom_id),
        default_valuation_method: payload.default_valuation_method,
        auto_insert_item_price_if_missing: payload.auto_insert_item_price_if_missing,
        update_existing_price_list_rate: payload.update_existing_price_list_rate,
        allow_edit_stock_uom_qty_sales_docs: payload.allow_edit_stock_uom_qty_sales_docs,
        allow_edit_stock_uom_qty_purchase_docs: payload.allow_edit_stock_uom_qty_purchase_docs,
        over_delivery_receipt_allowance_pct: payload.over_delivery_receipt_allowance_pct,
        over_transfer_allowance_pct: payload.over_transfer_allowance_pct,
        over_picking_allowance_pct: payload.over_picking_allowance_pct,
        allow_negative_stock: payload.allow_negative_stock,
        show_barcode_field_in_stock_transactions: payload.show_barcode_field_in_stock_transactions,
        convert_item_description_to_clean_html: payload.convert_item_description_to_clean_html,
        allow_internal_transfers_at_arms_length_price: payload
            .allow_internal_transfers_at_arms_length_price,
        qi_action_if_not_submitted: payload.qi_action_if_not_submitted,
        qi_action_if_rejected: payload.qi_action_if_rejected,
        enable_stock_reservation: payload.enable_stock_reservation,
        allow_partial_reservation: payload.allow_partial_reservation,
        auto_reserve_stock_for_sales_order_on_purchase: payload
            .auto_reserve_stock_for_sales_order_on_purchase,
        auto_reserve_serial_and_batch_nos: payload.auto_reserve_serial_and_batch_nos,
        auto_create_serial_and_batch_bundle_for_outward: payload
            .auto_create_serial_and_batch_bundle_for_outward,
        pick_serial_batch_based_on: payload.pick_serial_batch_based_on,
        disable_serial_no_and_batch_selector: payload.disable_serial_no_and_batch_selector,
        have_default_naming_series_for_batch_id: payload.have_default_naming_series_for_batch_id,
        use_serial_batch_fields: payload.use_serial_batch_fields,
        do_not_update_serial_batch_on_creation_of_auto_bundle: payload
            .do_not_update_serial_batch_on_creation_of_auto_bundle,
        allow_existing_serial_no_to_be_received_again: payload
            .allow_existing_serial_no_to_be_received_again,
        set_bundle_naming_based_on_naming_series: payload.set_bundle_naming_based_on_naming_series,
        raise_material_request_when_stock_reaches_reorder_level: payload
            .raise_material_request_when_stock_reaches_reorder_level,
        notify_by_email_on_creation_of_automatic_material_request: payload
            .notify_by_email_on_creation_of_automatic_material_request,
        allow_material_transfer_from_delivery_note_to_sales_invoice: payload
            .allow_material_transfer_from_delivery_note_to_sales_invoice,
        allow_material_transfer_from_purchase_receipt_to_purchase_invoice: payload
            .allow_material_transfer_from_purchase_receipt_to_purchase_invoice,
        freeze_stocks_older_than_days: payload.freeze_stocks_older_than_days,
        version: 0,
        updated_at: String::new(),
    }
}

fn version_conflict_error(current: StockSettingsView) -> (StatusCode, Json<ErrorEnvelope>) {
    api_error_with_details(
        StatusCode::CONFLICT,
        "CONFLICT",
        "Stock settings version mismatch",
        json!({
            "reason": "VERSION_MISMATCH",
            "current": current,
        }),
    )
}

async fn write_stock_settings(
    state: Arc<AppState>,
    headers: HeaderMap,
    expected_version_in_body: Option<i64>,
    next_unvalidated: StockSettingsView,
) -> Result<Json<StockSettingsResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    if !has_stock_settings_write_permission(&ctx) {
        return Err(api_error(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "Missing permission: inventory.settings.write",
        ));
    }

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let current_row = get_or_create_stock_settings_row(pool, &ctx.company_id, &ctx.user_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to load current stock settings");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load stock settings",
            )
        })?;
    let current = row_to_stock_settings(&current_row);

    let expected_version = parse_if_match(&headers)
        .or(expected_version_in_body)
        .ok_or_else(|| {
            api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "If-Match header or version field is required",
            )
        })?;

    if expected_version != current.version {
        return Err(version_conflict_error(current));
    }

    let mut next = next_unvalidated;
    next.version = current.version;
    next.updated_at = current.updated_at.clone();

    if let Err(errors) = validate_stock_settings(&next) {
        return Err(api_error_with_details(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "Invalid stock settings payload",
            json!({ "field_errors": errors }),
        ));
    }

    let updated_row = update_stock_settings_row(
        pool,
        &ctx.company_id,
        &ctx.user_id,
        expected_version,
        &next,
    )
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to update stock settings");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to update stock settings",
        )
    })?;

    let Some(updated_row) = updated_row else {
        let latest = get_or_create_stock_settings_row(pool, &ctx.company_id, &ctx.user_id)
            .await
            .map(|row| row_to_stock_settings(&row))
            .unwrap_or(current);
        return Err(version_conflict_error(latest));
    };

    let updated = row_to_stock_settings(&updated_row);
    insert_stock_settings_audit(pool, &ctx, &current, &updated).await;
    Ok(Json(StockSettingsResponse {
        ok: true,
        data: updated,
    }))
}

#[utoipa::path(
    patch,
    path = "/api/stock/settings",
    tag = "inventory",
    request_body = StockSettingsPatchRequest,
    responses(
        (status = 200, body = StockSettingsResponse),
        (status = 400, body = ErrorEnvelope),
        (status = 401, body = ErrorEnvelope),
        (status = 403, body = ErrorEnvelope),
        (status = 409, body = ErrorEnvelope),
        (status = 503, body = ErrorEnvelope)
    )
)]
async fn patch_stock_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<StockSettingsPatchRequest>,
) -> Result<Json<StockSettingsResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let expected = payload.version;
    let ctx_for_read = resolve_inventory_context(&headers, &state)?;
    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let current_row = get_or_create_stock_settings_row(pool, &ctx_for_read.company_id, &ctx_for_read.user_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx_for_read.request_id, "failed to load current stock settings for patch");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load stock settings",
            )
        })?;

    let current = row_to_stock_settings(&current_row);
    let next = merge_patch_into_stock_settings(&current, payload);

    write_stock_settings(state, headers, expected, next).await
}

#[utoipa::path(
    put,
    path = "/api/stock/settings",
    tag = "inventory",
    request_body = StockSettingsPutRequest,
    responses(
        (status = 200, body = StockSettingsResponse),
        (status = 400, body = ErrorEnvelope),
        (status = 401, body = ErrorEnvelope),
        (status = 403, body = ErrorEnvelope),
        (status = 409, body = ErrorEnvelope),
        (status = 503, body = ErrorEnvelope)
    )
)]
async fn put_stock_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<StockSettingsPutRequest>,
) -> Result<Json<StockSettingsResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let expected = payload.version;
    let next = validate_and_build_put(payload);
    write_stock_settings(state, headers, expected, next).await
}

async fn get_stock_workspace_metrics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<StockWorkspaceMetricsResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let row = sqlx::query_as::<_, WorkspaceMetricsDbRow>(
        r#"
        SELECT
          COALESCE(SUM(sb."onHand" * COALESCE(sb."avgCostMinor", p."unitCostMinor", 0)), 0)::bigint AS total_stock_value,
          (SELECT COUNT(1)::bigint FROM "InventoryWarehouse" w WHERE w."orgId" = $1 AND w."isActive" = TRUE) AS total_warehouses,
          (SELECT COUNT(1)::bigint FROM "Product" p2 WHERE p2."orgId" = $1 AND p2."isActive" = TRUE) AS total_active_items,
          COALESCE(MAX(sb."updatedAt"), NOW()) AS last_synced_at
        FROM "InventoryStockBalance" sb
        INNER JOIN "Product" p ON p."id" = sb."itemId"
        WHERE sb."orgId" = $1
        "#,
    )
    .bind(&ctx.company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to load stock workspace metrics");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load stock workspace metrics",
        )
    })?;

    Ok(Json(StockWorkspaceMetricsResponse {
        ok: true,
        data: StockWorkspaceMetricsView {
            total_stock_value: MoneyAmountView {
                amount: row.total_stock_value,
                currency: "BDT".to_string(),
            },
            total_warehouses: row.total_warehouses,
            total_active_items: row.total_active_items,
            last_synced_at: format_timestamp(row.last_synced_at),
        },
    }))
}

async fn get_stock_workspace_warehouse_stock_value(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<StockWarehouseValueResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let rows = sqlx::query_as::<_, WarehouseStockValueDbRow>(
        r#"
        SELECT
          w."id" AS warehouse_id,
          w."name" AS warehouse_name,
          COALESCE(SUM(sb."onHand" * COALESCE(sb."avgCostMinor", p."unitCostMinor", 0)), 0)::bigint AS stock_value
        FROM "InventoryWarehouse" w
        LEFT JOIN "InventoryStockBalance" sb ON sb."warehouseId" = w."id" AND sb."orgId" = w."orgId"
        LEFT JOIN "Product" p ON p."id" = sb."itemId"
        WHERE w."orgId" = $1 AND w."isActive" = TRUE
        GROUP BY w."id", w."name"
        ORDER BY w."name" ASC
        "#,
    )
    .bind(&ctx.company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to load warehouse stock value");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load warehouse stock value",
        )
    })?;

    let last_synced = sqlx::query_scalar::<_, Option<NaiveDateTime>>(
        r#"SELECT MAX("updatedAt") FROM "InventoryStockBalance" WHERE "orgId" = $1"#,
    )
    .bind(&ctx.company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to read stock sync time");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load warehouse stock value",
        )
    })?
    .unwrap_or_else(|| Utc::now().naive_utc());

    Ok(Json(StockWarehouseValueResponse {
        ok: true,
        data: StockWarehouseValueView {
            last_synced_at: format_timestamp(last_synced),
            series: rows
                .into_iter()
                .map(|row| StockWarehouseValuePoint {
                    warehouse_id: row.warehouse_id,
                    warehouse_name: row.warehouse_name,
                    stock_value: MoneyAmountView {
                        amount: row.stock_value,
                        currency: "BDT".to_string(),
                    },
                })
                .collect(),
        },
    }))
}

async fn get_stock_workspace_quick_access(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<StockQuickAccessResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let items_available = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(1)::bigint FROM "Product" WHERE "orgId" = $1 AND "isActive" = TRUE"#,
    )
    .bind(&ctx.company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to count items for quick access");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load quick access data",
        )
    })?;

    let delivery_note_to_bill = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)::bigint
        FROM "DeliveryNote"
        WHERE "orgId" = $1 AND "status" IN ('POSTED', 'APPROVED')
        "#,
    )
    .bind(&ctx.company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to count delivery notes for quick access");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load quick access data",
        )
    })?;

    let material_request_pending = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)::bigint
        FROM "MaterialRequest"
        WHERE "orgId" = $1 AND "status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_ORDERED')
        "#,
    )
    .bind(&ctx.company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to count material requests for quick access");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load quick access data",
        )
    })?;

    let purchase_receipt_to_bill = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)::bigint
        FROM "PurchaseReceipt"
        WHERE "orgId" = $1 AND "status" IN ('POSTED', 'APPROVED')
        "#,
    )
    .bind(&ctx.company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to count purchase receipts for quick access");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load quick access data",
        )
    })?;

    Ok(Json(StockQuickAccessResponse {
        ok: true,
        data: StockQuickAccessView {
            items_available,
            delivery_note_to_bill,
            material_request_pending,
            purchase_receipt_to_bill,
        },
    }))
}

async fn list_stock_items(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<StockItemsQuery>,
) -> Result<Json<StockItemsListResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).clamp(1, 2500);
    let offset = (page - 1) * page_size;
    let sort = normalize_sort(query.sort.as_deref());

    let id_filter = sanitize_optional_query(query.id.as_deref()).map(|v| format!("%{v}%"));
    let text_filter = sanitize_optional_query(query.query.as_deref()).map(|v| format!("%{v}%"));
    let item_group_filter = sanitize_optional_query(query.item_group.as_deref());
    let variant_of_filter = sanitize_optional_query(query.variant_of.as_deref());
    let assigned_to_filter = sanitize_optional_query(query.assigned_to.as_deref());
    let created_by_filter = sanitize_optional_query(query.created_by.as_deref());
    let has_variants_filter = query.has_variants;
    let tags_filter: Vec<String> = sanitize_optional_query(query.tags.as_deref())
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let mut count_builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        r#"
        SELECT COUNT(1)::bigint
        FROM "Product" p
        LEFT JOIN "SetupItemGroup" ig ON ig."id" = p."itemGroupId"
        WHERE p."orgId" = 
        "#,
    );
    count_builder.push_bind(&ctx.company_id);

    if let Some(value) = id_filter.as_deref() {
        count_builder.push(r#" AND p."id" ILIKE "#).push_bind(value);
    }
    if let Some(value) = text_filter.as_deref() {
        count_builder
            .push(r#" AND (p."sku" ILIKE "#)
            .push_bind(value)
            .push(r#" OR p."name" ILIKE "#)
            .push_bind(value)
            .push(r#" OR COALESCE(p."description", '') ILIKE "#)
            .push_bind(value)
            .push(")");
    }
    if let Some(value) = item_group_filter.as_deref() {
        count_builder
            .push(r#" AND (ig."name" ILIKE "#)
            .push_bind(format!("%{value}%"))
            .push(r#" OR p."itemGroupId" = "#)
            .push_bind(value)
            .push(")");
    }
    if let Some(value) = variant_of_filter.as_deref() {
        count_builder
            .push(r#" AND p."variantOfId" = "#)
            .push_bind(value);
    }
    if let Some(value) = assigned_to_filter.as_deref() {
        count_builder
            .push(r#" AND p."assignedTo" ILIKE "#)
            .push_bind(format!("%{value}%"));
    }
    if let Some(value) = created_by_filter.as_deref() {
        count_builder
            .push(r#" AND p."createdBy" ILIKE "#)
            .push_bind(format!("%{value}%"));
    }
    if let Some(has_variants) = has_variants_filter {
        if has_variants {
            count_builder.push(
                r#" AND (p."isTemplate" = TRUE OR EXISTS (
                    SELECT 1 FROM "Product" pv WHERE pv."orgId" = p."orgId" AND pv."variantOfId" = p."id"
                  ))"#,
            );
        } else {
            count_builder.push(
                r#" AND p."isTemplate" = FALSE AND NOT EXISTS (
                    SELECT 1 FROM "Product" pv WHERE pv."orgId" = p."orgId" AND pv."variantOfId" = p."id"
                  )"#,
            );
        }
    }
    if !tags_filter.is_empty() {
        count_builder
            .push(
                r#" AND EXISTS (
                    SELECT 1
                    FROM "InventoryItemTag" it
                    WHERE it."orgId" = p."orgId"
                      AND it."itemId" = p."id"
                      AND it."tag" = ANY("#,
            )
            .push_bind(tags_filter.clone())
            .push(
                r#")
                )"#,
            );
    }

    let total = count_builder
        .build_query_scalar::<i64>()
        .fetch_one(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to count stock items");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to count stock items",
            )
        })?;

    let mut rows_builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        r#"
        SELECT
          p."id" AS id,
          p."name" AS item_name,
          CASE
            WHEN p."isTemplate" = TRUE THEN 'TEMPLATE'
            WHEN p."isActive" = TRUE THEN 'ENABLED'
            ELSE 'DISABLED'
          END AS status,
          ig."name" AS item_group,
          p."sku" AS item_code,
          p."updatedAt" AS updated_at,
          (p."isTemplate" = TRUE OR EXISTS (
              SELECT 1 FROM "Product" pv WHERE pv."orgId" = p."orgId" AND pv."variantOfId" = p."id"
            )) AS has_variants,
          p."variantOfId" AS variant_of,
          p."assignedTo" AS assigned_to,
          p."createdBy" AS created_by
        FROM "Product" p
        LEFT JOIN "SetupItemGroup" ig ON ig."id" = p."itemGroupId"
        WHERE p."orgId" = 
        "#,
    );
    rows_builder.push_bind(&ctx.company_id);

    if let Some(value) = id_filter.as_deref() {
        rows_builder.push(r#" AND p."id" ILIKE "#).push_bind(value);
    }
    if let Some(value) = text_filter.as_deref() {
        rows_builder
            .push(r#" AND (p."sku" ILIKE "#)
            .push_bind(value)
            .push(r#" OR p."name" ILIKE "#)
            .push_bind(value)
            .push(r#" OR COALESCE(p."description", '') ILIKE "#)
            .push_bind(value)
            .push(")");
    }
    if let Some(value) = item_group_filter.as_deref() {
        rows_builder
            .push(r#" AND (ig."name" ILIKE "#)
            .push_bind(format!("%{value}%"))
            .push(r#" OR p."itemGroupId" = "#)
            .push_bind(value)
            .push(")");
    }
    if let Some(value) = variant_of_filter.as_deref() {
        rows_builder
            .push(r#" AND p."variantOfId" = "#)
            .push_bind(value);
    }
    if let Some(value) = assigned_to_filter.as_deref() {
        rows_builder
            .push(r#" AND p."assignedTo" ILIKE "#)
            .push_bind(format!("%{value}%"));
    }
    if let Some(value) = created_by_filter.as_deref() {
        rows_builder
            .push(r#" AND p."createdBy" ILIKE "#)
            .push_bind(format!("%{value}%"));
    }
    if let Some(has_variants) = has_variants_filter {
        if has_variants {
            rows_builder.push(
                r#" AND (p."isTemplate" = TRUE OR EXISTS (
                    SELECT 1 FROM "Product" pv WHERE pv."orgId" = p."orgId" AND pv."variantOfId" = p."id"
                  ))"#,
            );
        } else {
            rows_builder.push(
                r#" AND p."isTemplate" = FALSE AND NOT EXISTS (
                    SELECT 1 FROM "Product" pv WHERE pv."orgId" = p."orgId" AND pv."variantOfId" = p."id"
                  )"#,
            );
        }
    }
    if !tags_filter.is_empty() {
        rows_builder
            .push(
                r#" AND EXISTS (
                    SELECT 1
                    FROM "InventoryItemTag" it
                    WHERE it."orgId" = p."orgId"
                      AND it."itemId" = p."id"
                      AND it."tag" = ANY("#,
            )
            .push_bind(tags_filter.clone())
            .push(
                r#")
                )"#,
            );
    }

    match sort {
        "name_asc" => rows_builder.push(r#" ORDER BY p."name" ASC, p."updatedAt" DESC"#),
        "name_desc" => rows_builder.push(r#" ORDER BY p."name" DESC, p."updatedAt" DESC"#),
        _ => rows_builder.push(r#" ORDER BY p."updatedAt" DESC"#),
    };
    rows_builder
        .push(" LIMIT ")
        .push_bind(page_size)
        .push(" OFFSET ")
        .push_bind(offset);

    let rows = rows_builder
        .build_query_as::<StockItemsDbRow>()
        .fetch_all(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to list stock items");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load stock items",
            )
        })?;

    let item_ids = rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>();
    let tag_rows = if item_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, ItemTagDbRow>(
            r#"
            SELECT "itemId" AS item_id, "tag" AS tag
            FROM "InventoryItemTag"
            WHERE "orgId" = $1 AND "itemId" = ANY($2::text[])
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(&ctx.company_id)
        .bind(&item_ids)
        .fetch_all(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to load stock item tags");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load stock items",
            )
        })?
    };

    let mut tags_by_item: HashMap<String, Vec<String>> = HashMap::new();
    for tag in tag_rows {
        tags_by_item.entry(tag.item_id).or_default().push(tag.tag);
    }

    let items = rows
        .into_iter()
        .map(|row| StockListItemView {
            id: row.id.clone(),
            item_name: row.item_name,
            status: row.status,
            item_group: row.item_group,
            item_code: row.item_code,
            updated_at: format_timestamp(row.updated_at),
            has_variants: row.has_variants,
            variant_of: row.variant_of,
            assigned_to: row.assigned_to,
            created_by: row.created_by,
            tags: tags_by_item.remove(&row.id).unwrap_or_default(),
        })
        .collect::<Vec<_>>();

    Ok(Json(StockItemsListResponse {
        ok: true,
        data: StockItemsListData {
            total,
            page,
            page_size,
            items,
        },
    }))
}

async fn list_stock_settings_comments(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<StockSettingsCommentsResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let rows = sqlx::query_as::<_, StockSettingsCommentDbRow>(
        r#"
        SELECT
          "id" AS id,
          "userId" AS user_id,
          "comment" AS comment,
          "createdAt" AS created_at,
          "updatedAt" AS updated_at,
          "isEdited" AS is_edited
        FROM "InventorySettingComment"
        WHERE "orgId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 200
        "#,
    )
    .bind(&ctx.company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to list stock settings comments");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load stock settings comments",
        )
    })?;

    Ok(Json(StockSettingsCommentsResponse {
        ok: true,
        data: StockSettingsCommentsData {
            rows: rows
                .into_iter()
                .map(|row| StockSettingsCommentView {
                    id: row.id,
                    user_id: row.user_id,
                    comment: row.comment,
                    created_at: format_timestamp(row.created_at),
                    updated_at: format_timestamp(row.updated_at),
                    is_edited: row.is_edited,
                })
                .collect(),
        },
    }))
}

async fn create_stock_settings_comment(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<StockSettingsCommentCreateRequest>,
) -> Result<Json<StockSettingsCommentResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    if !has_stock_settings_write_permission(&ctx) {
        return Err(api_error(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "Stock settings comments require level 4 or higher",
        ));
    }

    let comment = payload.comment.trim();
    if comment.is_empty() {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "comment is required",
        ));
    }
    if comment.len() > 4000 {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "comment must be <= 4000 characters",
        ));
    }

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let row = sqlx::query_as::<_, StockSettingsCommentDbRow>(
        r#"
        INSERT INTO "InventorySettingComment" (
          "id", "orgId", "userId", "comment", "isEdited", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())
        RETURNING
          "id" AS id,
          "userId" AS user_id,
          "comment" AS comment,
          "createdAt" AS created_at,
          "updatedAt" AS updated_at,
          "isEdited" AS is_edited
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&ctx.company_id)
    .bind(&ctx.user_id)
    .bind(comment)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to create stock settings comment");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to create stock settings comment",
        )
    })?;

    let inserted_comment_id = row.id.clone();
    let inserted_comment_text = row.comment.clone();
    let _ = sqlx::query(
        r#"
        INSERT INTO "InventoryAuditLog" (
          "id", "orgId", "actorUserId", "action", "entityType", "entityId",
          "before", "after", "diff", "requestId", "ipAddress", "userAgent", "metadata", "createdAt"
        )
        VALUES (
          $1, $2, $3, 'STOCK_SETTINGS_COMMENT_ADDED', 'InventoryCompanySetting', $2,
          NULL, $4, NULL, $5, NULL, NULL, $6, NOW()
        )
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&ctx.company_id)
    .bind(&ctx.user_id)
    .bind(json!({"comment": inserted_comment_text, "commentId": inserted_comment_id}))
    .bind(&ctx.request_id)
    .bind(SqlJson(json!({"commentId": inserted_comment_id})))
    .execute(pool)
    .await;

    Ok(Json(StockSettingsCommentResponse {
        ok: true,
        data: StockSettingsCommentView {
            id: row.id,
            user_id: row.user_id,
            comment: row.comment,
            created_at: format_timestamp(row.created_at),
            updated_at: format_timestamp(row.updated_at),
            is_edited: row.is_edited,
        },
    }))
}

async fn list_stock_settings_activity(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<StockSettingsActivityResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let rows = sqlx::query_as::<_, StockSettingsActivityDbRow>(
        r#"
        SELECT
          "id" AS id,
          CASE
            WHEN "action" = 'STOCK_SETTINGS_UPDATED' THEN 'SETTINGS_UPDATED'
            WHEN "action" = 'STOCK_SETTINGS_COMMENT_ADDED' THEN 'COMMENT_ADDED'
            ELSE "action"
          END AS entry_type,
          CASE
            WHEN "action" = 'STOCK_SETTINGS_UPDATED' THEN 'Stock settings updated'
            WHEN "action" = 'STOCK_SETTINGS_COMMENT_ADDED' THEN 'Comment added'
            ELSE COALESCE("action", 'Activity')
          END AS message,
          "actorUserId" AS actor_user_id,
          "createdAt" AS created_at,
          "metadata" AS metadata
        FROM "InventoryAuditLog"
        WHERE "orgId" = $1
          AND "action" IN ('STOCK_SETTINGS_UPDATED', 'STOCK_SETTINGS_COMMENT_ADDED')
        ORDER BY "createdAt" DESC
        LIMIT 300
        "#,
    )
    .bind(&ctx.company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to list stock settings activity");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load stock settings activity",
        )
    })?;

    Ok(Json(StockSettingsActivityResponse {
        ok: true,
        data: StockSettingsActivityData {
            rows: rows
                .into_iter()
                .map(|row| StockSettingsActivityView {
                    id: row.id,
                    r#type: row.entry_type,
                    message: row.message,
                    actor_user_id: row.actor_user_id,
                    created_at: format_timestamp(row.created_at),
                    metadata: row.metadata,
                })
                .collect(),
        },
    }))
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

#[utoipa::path(
    patch,
    path = "/api/v1/inventory/items/{item_id}",
    tag = "inventory",
    params(("item_id" = String, Path, description = "Inventory item id")),
    request_body = UpdateInventoryItemRequest,
    responses(
        (status = 200, body = InventoryItemResponse),
        (status = 400, body = ErrorEnvelope),
        (status = 401, body = ErrorEnvelope),
        (status = 403, body = ErrorEnvelope),
        (status = 404, body = ErrorEnvelope),
        (status = 409, body = ErrorEnvelope),
        (status = 503, body = ErrorEnvelope)
    )
)]
async fn update_inventory_item(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(item_id): Path<String>,
    Json(payload): Json<UpdateInventoryItemRequest>,
) -> Result<Json<InventoryItemResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "update inventory item"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let existing = fetch_inventory_item_by_id(pool, &ctx.company_id, &item_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to fetch inventory item for update");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load inventory item",
            )
        })?
        .ok_or_else(|| api_error(StatusCode::NOT_FOUND, "NOT_FOUND", "Item not found"))?;

    let normalized_sku = payload
        .sku
        .as_deref()
        .map(normalize_sku)
        .filter(|value| !value.is_empty());

    if payload.sku.is_some() && normalized_sku.is_none() {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "sku must not be empty",
        ));
    }

    if let Some(name) = payload.name.as_deref() {
        if normalize_required_text(name).is_none() {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "name must not be empty",
            ));
        }
    }

    let effective_brand_id = payload
        .brand_id
        .as_deref()
        .and_then(normalize_required_text)
        .unwrap_or_else(|| existing.brand_id.clone());

    if payload.brand_id.is_some() {
        let brand_exists = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(1)::bigint
            FROM "Brand"
            WHERE "id" = $1 AND "orgId" = $2
            "#,
        )
        .bind(&effective_brand_id)
        .bind(&ctx.company_id)
        .fetch_one(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to validate brand on update");
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
    }

    if let Some(normalized) = normalized_sku.as_deref() {
        let conflict = sqlx::query_scalar::<_, Option<String>>(
            r#"
            SELECT "id"
            FROM "Product"
            WHERE "orgId" = $1
              AND "brandId" = $2
              AND "normalizedSku" = $3
              AND "id" <> $4
            LIMIT 1
            "#,
        )
        .bind(&ctx.company_id)
        .bind(&effective_brand_id)
        .bind(normalized)
        .bind(&item_id)
        .fetch_one(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to check sku conflict on update");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to update inventory item",
            )
        })?;

        if conflict.is_some() {
            return Err(api_error(
                StatusCode::CONFLICT,
                "CONFLICT",
                "SKU already exists for this brand",
            ));
        }
    }

    let normalized_name = payload.name.as_deref().and_then(normalize_required_text);
    let normalized_description = payload.description.as_deref().map(str::trim);
    let normalized_uom = payload.uom.as_deref().and_then(normalize_required_text);

    let updated_id = sqlx::query_scalar::<_, Option<String>>(
        r#"
        UPDATE "Product"
        SET
          "sku" = COALESCE($3, "sku"),
          "normalizedSku" = COALESCE($4, "normalizedSku"),
          "name" = COALESCE($5, "name"),
          "title" = COALESCE($5, "title"),
          "description" = COALESCE($6, "description"),
          "brandId" = COALESCE($7, "brandId"),
          "uom" = COALESCE($8, "uom"),
          "priceCents" = COALESCE($9, "priceCents"),
          "unitCostMinor" = COALESCE($10, "unitCostMinor"),
          "trackSerial" = COALESCE($11, "trackSerial"),
          "trackBatch" = COALESCE($12, "trackBatch"),
          "lowStockThreshold" = COALESCE($13, "lowStockThreshold"),
          "isActive" = COALESCE($14, "isActive"),
          "updatedAt" = NOW()
        WHERE "orgId" = $1 AND "id" = $2
        RETURNING "id"
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&item_id)
    .bind(payload.sku.as_deref().map(str::trim))
    .bind(normalized_sku.as_deref())
    .bind(normalized_name.as_deref())
    .bind(normalized_description)
    .bind(payload.brand_id.as_deref().map(str::trim))
    .bind(normalized_uom.as_deref())
    .bind(payload.price_cents)
    .bind(payload.unit_cost_minor)
    .bind(payload.track_serial)
    .bind(payload.track_batch)
    .bind(payload.low_stock_threshold)
    .bind(payload.is_active)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to update inventory item");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to update inventory item",
        )
    })?;

    if updated_id.is_none() {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Item not found",
        ));
    }

    if let Some(new_sku) = payload.sku.as_deref().and_then(normalize_required_text) {
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
        .bind(new_sku)
        .execute(pool)
        .await;
    }

    let item = fetch_inventory_item_by_id(pool, &ctx.company_id, &item_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to fetch updated inventory item");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load updated item",
            )
        })?
        .map(map_item)
        .ok_or_else(|| api_error(StatusCode::NOT_FOUND, "NOT_FOUND", "Item not found"))?;

    Ok(Json(InventoryItemResponse {
        ok: true,
        data: item,
    }))
}

#[utoipa::path(
    delete,
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
async fn archive_inventory_item(
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
        "archive inventory item"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let archived = sqlx::query_scalar::<_, Option<String>>(
        r#"
        UPDATE "Product"
        SET "isActive" = FALSE, "updatedAt" = NOW()
        WHERE "orgId" = $1 AND "id" = $2
        RETURNING "id"
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&item_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to archive inventory item");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to archive inventory item",
        )
    })?;

    if archived.is_none() {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Item not found",
        ));
    }

    let item = fetch_inventory_item_by_id(pool, &ctx.company_id, &item_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to fetch archived inventory item");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load archived item",
            )
        })?
        .map(map_item)
        .ok_or_else(|| api_error(StatusCode::NOT_FOUND, "NOT_FOUND", "Item not found"))?;

    Ok(Json(InventoryItemResponse {
        ok: true,
        data: item,
    }))
}

async fn list_inventory_warehouses(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<InventoryWarehousesResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "list inventory warehouses"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let rows = fetch_inventory_warehouses(pool, &ctx.company_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to list inventory warehouses");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load warehouses",
            )
        })?;

    Ok(Json(InventoryWarehousesResponse {
        ok: true,
        data: rows,
    }))
}

async fn create_inventory_warehouse(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateInventoryWarehouseRequest>,
) -> Result<(StatusCode, Json<InventoryWarehouseResponse>), (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "create inventory warehouse"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let code = normalize_required_text(&payload.code).ok_or_else(|| {
        api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "code is required",
        )
    })?;
    let name = normalize_required_text(&payload.name).ok_or_else(|| {
        api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "name is required",
        )
    })?;
    let description = normalize_optional_text(payload.description.as_deref());
    let parent_warehouse_id = normalize_optional_text(payload.parent_warehouse_id.as_deref());

    if let Some(parent_id) = parent_warehouse_id.as_deref() {
        let parent_exists = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(1)::bigint
            FROM "InventoryWarehouse"
            WHERE "orgId" = $1 AND "id" = $2
            "#,
        )
        .bind(&ctx.company_id)
        .bind(parent_id)
        .fetch_one(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to validate parent warehouse");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to validate parent warehouse",
            )
        })?;

        if parent_exists == 0 {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "Invalid parentWarehouseId for this company",
            ));
        }
    }

    let code_conflict = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)::bigint
        FROM "InventoryWarehouse"
        WHERE "orgId" = $1 AND "code" = $2
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&code)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to check warehouse code conflict");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to validate warehouse",
        )
    })?;

    if code_conflict > 0 {
        return Err(api_error(
            StatusCode::CONFLICT,
            "CONFLICT",
            "Warehouse code already exists",
        ));
    }

    let metadata = payload
        .address
        .as_ref()
        .map(address_to_json)
        .map(|address| json!({ "address": address }));

    let warehouse_id = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO "InventoryWarehouse" (
          "orgId",
          "parentWarehouseId",
          "code",
          "name",
          "description",
          "isActive",
          "metadata",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING "id"
        "#,
    )
    .bind(&ctx.company_id)
    .bind(parent_warehouse_id.as_deref())
    .bind(&code)
    .bind(&name)
    .bind(description.as_deref())
    .bind(payload.is_active.unwrap_or(true))
    .bind(metadata)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to create warehouse");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to create warehouse",
        )
    })?;

    let warehouse = fetch_inventory_warehouse_by_id(pool, &ctx.company_id, &warehouse_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to fetch created warehouse");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load created warehouse",
            )
        })?
        .ok_or_else(|| {
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Created warehouse could not be reloaded",
            )
        })?;

    Ok((
        StatusCode::CREATED,
        Json(InventoryWarehouseResponse {
            ok: true,
            data: warehouse,
        }),
    ))
}

async fn update_inventory_warehouse(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(warehouse_id): Path<String>,
    Json(payload): Json<UpdateInventoryWarehouseRequest>,
) -> Result<Json<InventoryWarehouseResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "update inventory warehouse"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let existing = sqlx::query_scalar::<_, Option<String>>(
        r#"
        SELECT "id"
        FROM "InventoryWarehouse"
        WHERE "orgId" = $1 AND "id" = $2
        LIMIT 1
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&warehouse_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to load warehouse for update");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load warehouse",
        )
    })?;

    if existing.is_none() {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Warehouse not found",
        ));
    }

    let next_parent_id = normalize_optional_text(payload.parent_warehouse_id.as_deref());
    if let Some(parent_id) = next_parent_id.as_deref() {
        if parent_id == warehouse_id {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "Warehouse cannot be its own parent",
            ));
        }

        let parent = sqlx::query_as::<_, (String, Option<String>)>(
            r#"
            SELECT "id", "parentWarehouseId"
            FROM "InventoryWarehouse"
            WHERE "orgId" = $1 AND "id" = $2
            LIMIT 1
            "#,
        )
        .bind(&ctx.company_id)
        .bind(parent_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to validate parent warehouse on update");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to validate parent warehouse",
            )
        })?;

        let Some((_, parent_parent_id)) = parent else {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "Invalid parentWarehouseId for this company",
            ));
        };

        if parent_parent_id.as_deref() == Some(warehouse_id.as_str()) {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "Parent warehouse cycle detected",
            ));
        }
    }

    if let Some(code) = payload.code.as_deref().and_then(normalize_required_text) {
        let conflict = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(1)::bigint
            FROM "InventoryWarehouse"
            WHERE "orgId" = $1 AND "code" = $2 AND "id" <> $3
            "#,
        )
        .bind(&ctx.company_id)
        .bind(&code)
        .bind(&warehouse_id)
        .fetch_one(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to check warehouse code conflict on update");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to validate warehouse code",
            )
        })?;

        if conflict > 0 {
            return Err(api_error(
                StatusCode::CONFLICT,
                "CONFLICT",
                "Warehouse code already exists",
            ));
        }
    }

    let metadata_address = payload.address.as_ref().map(address_to_json);
    let code = payload.code.as_deref().and_then(normalize_required_text);
    let name = payload.name.as_deref().and_then(normalize_required_text);
    let description = payload.description.as_deref().map(str::trim);

    let updated = sqlx::query_scalar::<_, Option<String>>(
        r#"
        UPDATE "InventoryWarehouse"
        SET
          "code" = COALESCE($3, "code"),
          "name" = COALESCE($4, "name"),
          "description" = COALESCE($5, "description"),
          "parentWarehouseId" = COALESCE($6, "parentWarehouseId"),
          "metadata" = CASE
            WHEN $7::jsonb IS NULL THEN "metadata"
            ELSE jsonb_set(COALESCE("metadata", '{}'::jsonb), '{address}', $7::jsonb, true)
          END,
          "isActive" = COALESCE($8, "isActive"),
          "updatedAt" = NOW()
        WHERE "orgId" = $1 AND "id" = $2
        RETURNING "id"
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&warehouse_id)
    .bind(code.as_deref())
    .bind(name.as_deref())
    .bind(description)
    .bind(next_parent_id.as_deref())
    .bind(metadata_address)
    .bind(payload.is_active)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to update warehouse");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to update warehouse",
        )
    })?;

    if updated.is_none() {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Warehouse not found",
        ));
    }

    let warehouse = fetch_inventory_warehouse_by_id(pool, &ctx.company_id, &warehouse_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to fetch updated warehouse");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load updated warehouse",
            )
        })?
        .ok_or_else(|| api_error(StatusCode::NOT_FOUND, "NOT_FOUND", "Warehouse not found"))?;

    Ok(Json(InventoryWarehouseResponse {
        ok: true,
        data: warehouse,
    }))
}

async fn archive_inventory_warehouse(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(warehouse_id): Path<String>,
) -> Result<Json<InventoryWarehouseResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "archive inventory warehouse"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let archived = sqlx::query_scalar::<_, Option<String>>(
        r#"
        UPDATE "InventoryWarehouse"
        SET "isActive" = FALSE, "updatedAt" = NOW()
        WHERE "orgId" = $1 AND "id" = $2
        RETURNING "id"
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&warehouse_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to archive warehouse");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to archive warehouse",
        )
    })?;

    if archived.is_none() {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Warehouse not found",
        ));
    }

    let warehouse = fetch_inventory_warehouse_by_id(pool, &ctx.company_id, &warehouse_id)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to fetch archived warehouse");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to load archived warehouse",
            )
        })?
        .ok_or_else(|| api_error(StatusCode::NOT_FOUND, "NOT_FOUND", "Warehouse not found"))?;

    Ok(Json(InventoryWarehouseResponse {
        ok: true,
        data: warehouse,
    }))
}

async fn create_inventory_location(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateInventoryLocationRequest>,
) -> Result<(StatusCode, Json<InventoryLocationResponse>), (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "create inventory location"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let warehouse_id = normalize_required_text(&payload.warehouse_id).ok_or_else(|| {
        api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "warehouseId is required",
        )
    })?;
    let code = normalize_required_text(&payload.code).ok_or_else(|| {
        api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "code is required",
        )
    })?;
    let name = normalize_required_text(&payload.name).ok_or_else(|| {
        api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "name is required",
        )
    })?;
    let parent_id = normalize_optional_text(payload.parent_id.as_deref());

    let warehouse_exists = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)::bigint
        FROM "InventoryWarehouse"
        WHERE "orgId" = $1 AND "id" = $2
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&warehouse_id)
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to validate location warehouse");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to validate warehouse",
        )
    })?;
    if warehouse_exists == 0 {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "warehouseId does not belong to this company",
        ));
    }

    if let Some(parent_location_id) = parent_id.as_deref() {
        let parent_exists = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(1)::bigint
            FROM "InventoryWarehouseLocation"
            WHERE "orgId" = $1 AND "id" = $2 AND "warehouseId" = $3
            "#,
        )
        .bind(&ctx.company_id)
        .bind(parent_location_id)
        .bind(&warehouse_id)
        .fetch_one(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to validate parent location");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to validate parent location",
            )
        })?;
        if parent_exists == 0 {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "parentId does not belong to this warehouse",
            ));
        }
    }

    let created = sqlx::query_as::<_, InventoryLocationDbRow>(
        r#"
        INSERT INTO "InventoryWarehouseLocation" (
          "orgId",
          "warehouseId",
          "parentId",
          "code",
          "name",
          "path",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING
          "id" AS id,
          "warehouseId" AS warehouse_id,
          "code" AS code,
          "name" AS name,
          "isActive" AS is_active
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&warehouse_id)
    .bind(parent_id.as_deref())
    .bind(&code)
    .bind(&name)
    .bind(payload.path.as_deref().map(str::trim))
    .bind(payload.is_active.unwrap_or(true))
    .fetch_one(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to create location");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to create location",
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(InventoryLocationResponse {
            ok: true,
            data: InventoryLocationView {
                id: created.id,
                code: created.code,
                name: created.name,
                is_active: created.is_active,
            },
        }),
    ))
}

async fn update_inventory_location(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(location_id): Path<String>,
    Json(payload): Json<UpdateInventoryLocationRequest>,
) -> Result<Json<InventoryLocationResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "update inventory location"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let current = sqlx::query_as::<_, InventoryLocationDbRow>(
        r#"
        SELECT
          "id" AS id,
          "warehouseId" AS warehouse_id,
          "code" AS code,
          "name" AS name,
          "isActive" AS is_active
        FROM "InventoryWarehouseLocation"
        WHERE "orgId" = $1 AND "id" = $2
        LIMIT 1
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&location_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to load location for update");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to load location",
        )
    })?;

    let Some(current_row) = current else {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Location not found",
        ));
    };

    let target_warehouse = payload
        .warehouse_id
        .as_deref()
        .and_then(normalize_required_text)
        .unwrap_or_else(|| current_row.warehouse_id.clone());

    if let Some(parent_id) = payload
        .parent_id
        .as_deref()
        .and_then(normalize_required_text)
    {
        if parent_id == location_id {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "Location cannot be its own parent",
            ));
        }
        let parent_exists = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(1)::bigint
            FROM "InventoryWarehouseLocation"
            WHERE "orgId" = $1 AND "id" = $2 AND "warehouseId" = $3
            "#,
        )
        .bind(&ctx.company_id)
        .bind(&parent_id)
        .bind(&target_warehouse)
        .fetch_one(pool)
        .await
        .map_err(|error| {
            warn!(error = %error, request_id = %ctx.request_id, "failed to validate location parent on update");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Failed to validate parent location",
            )
        })?;
        if parent_exists == 0 {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                "parentId does not belong to target warehouse",
            ));
        }
    }

    let updated = sqlx::query_as::<_, InventoryLocationDbRow>(
        r#"
        UPDATE "InventoryWarehouseLocation"
        SET
          "warehouseId" = COALESCE($3, "warehouseId"),
          "parentId" = COALESCE($4, "parentId"),
          "code" = COALESCE($5, "code"),
          "name" = COALESCE($6, "name"),
          "path" = COALESCE($7, "path"),
          "isActive" = COALESCE($8, "isActive"),
          "updatedAt" = NOW()
        WHERE "orgId" = $1 AND "id" = $2
        RETURNING
          "id" AS id,
          "warehouseId" AS warehouse_id,
          "code" AS code,
          "name" AS name,
          "isActive" AS is_active
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&location_id)
    .bind(
        payload
            .warehouse_id
            .as_deref()
            .and_then(normalize_required_text),
    )
    .bind(
        payload
            .parent_id
            .as_deref()
            .and_then(normalize_required_text),
    )
    .bind(payload.code.as_deref().and_then(normalize_required_text))
    .bind(payload.name.as_deref().and_then(normalize_required_text))
    .bind(payload.path.as_deref().map(str::trim))
    .bind(payload.is_active)
    .fetch_optional(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to update location");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to update location",
        )
    })?;

    let Some(location) = updated else {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Location not found",
        ));
    };

    Ok(Json(InventoryLocationResponse {
        ok: true,
        data: InventoryLocationView {
            id: location.id,
            code: location.code,
            name: location.name,
            is_active: location.is_active,
        },
    }))
}

async fn archive_inventory_location(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(location_id): Path<String>,
) -> Result<Json<InventoryLocationResponse>, (StatusCode, Json<ErrorEnvelope>)> {
    let ctx = resolve_inventory_context(&headers, &state)?;
    info!(
        request_id = %ctx.request_id,
        company_id = %ctx.company_id,
        tenant_id = %ctx.tenant_id,
        user_id = %ctx.user_id,
        "archive inventory location"
    );

    let pool = state.db_pool.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "Database is not configured",
        )
    })?;

    let archived = sqlx::query_as::<_, InventoryLocationDbRow>(
        r#"
        UPDATE "InventoryWarehouseLocation"
        SET "isActive" = FALSE, "updatedAt" = NOW()
        WHERE "orgId" = $1 AND "id" = $2
        RETURNING
          "id" AS id,
          "warehouseId" AS warehouse_id,
          "code" AS code,
          "name" AS name,
          "isActive" AS is_active
        "#,
    )
    .bind(&ctx.company_id)
    .bind(&location_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, request_id = %ctx.request_id, "failed to archive location");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Failed to archive location",
        )
    })?;

    let Some(location) = archived else {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Location not found",
        ));
    };

    Ok(Json(InventoryLocationResponse {
        ok: true,
        data: InventoryLocationView {
            id: location.id,
            code: location.code,
            name: location.name,
            is_active: location.is_active,
        },
    }))
}

fn build_router(state: Arc<AppState>) -> Router {
    let request_id_header = HeaderName::from_static("x-request-id");

    Router::new()
        .route("/api/health", get(health))
        .route("/api/v1/ping", get(ping))
        .route(
            "/api/stock/settings",
            get(get_stock_settings)
                .patch(patch_stock_settings)
                .put(put_stock_settings),
        )
        .route(
            "/api/stock/settings/comments",
            get(list_stock_settings_comments).post(create_stock_settings_comment),
        )
        .route(
            "/api/stock/settings/activity",
            get(list_stock_settings_activity),
        )
        .route(
            "/api/stock/workspace/metrics",
            get(get_stock_workspace_metrics),
        )
        .route(
            "/api/stock/workspace/warehouse-stock-value",
            get(get_stock_workspace_warehouse_stock_value),
        )
        .route(
            "/api/stock/workspace/quick-access",
            get(get_stock_workspace_quick_access),
        )
        .route("/api/stock/items", get(list_stock_items))
        .route(
            "/api/v1/inventory/items",
            get(list_inventory_items).post(create_inventory_item),
        )
        .route(
            "/api/v1/inventory/items/{item_id}",
            get(get_inventory_item)
                .patch(update_inventory_item)
                .delete(archive_inventory_item),
        )
        .route(
            "/api/v1/inventory/warehouses",
            get(list_inventory_warehouses).post(create_inventory_warehouse),
        )
        .route(
            "/api/v1/inventory/warehouses/{warehouse_id}",
            patch(update_inventory_warehouse).delete(archive_inventory_warehouse),
        )
        .route(
            "/api/v1/inventory/locations",
            post(create_inventory_location),
        )
        .route(
            "/api/v1/inventory/locations/{location_id}",
            patch(update_inventory_location).delete(archive_inventory_location),
        )
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

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};
    use sqlx::postgres::PgPoolOptions;

    fn valid_settings() -> StockSettingsView {
        StockSettingsView {
            item_naming_by: "ITEM_CODE".to_string(),
            default_warehouse_id: None,
            default_stock_uom_id: None,
            default_valuation_method: "FIFO".to_string(),
            auto_insert_item_price_if_missing: true,
            update_existing_price_list_rate: false,
            allow_edit_stock_uom_qty_sales_docs: true,
            allow_edit_stock_uom_qty_purchase_docs: true,
            over_delivery_receipt_allowance_pct: 0.0,
            over_transfer_allowance_pct: 0.0,
            over_picking_allowance_pct: 0.0,
            allow_negative_stock: false,
            show_barcode_field_in_stock_transactions: true,
            convert_item_description_to_clean_html: true,
            allow_internal_transfers_at_arms_length_price: false,
            qi_action_if_not_submitted: "STOP".to_string(),
            qi_action_if_rejected: "STOP".to_string(),
            enable_stock_reservation: true,
            allow_partial_reservation: false,
            auto_reserve_stock_for_sales_order_on_purchase: false,
            auto_reserve_serial_and_batch_nos: false,
            auto_create_serial_and_batch_bundle_for_outward: true,
            pick_serial_batch_based_on: "FIFO".to_string(),
            disable_serial_no_and_batch_selector: false,
            have_default_naming_series_for_batch_id: false,
            use_serial_batch_fields: false,
            do_not_update_serial_batch_on_creation_of_auto_bundle: false,
            allow_existing_serial_no_to_be_received_again: true,
            set_bundle_naming_based_on_naming_series: false,
            raise_material_request_when_stock_reaches_reorder_level: true,
            notify_by_email_on_creation_of_automatic_material_request: false,
            allow_material_transfer_from_delivery_note_to_sales_invoice: false,
            allow_material_transfer_from_purchase_receipt_to_purchase_invoice: false,
            freeze_stocks_older_than_days: 60,
            version: 1,
            updated_at: "2026-01-01T00:00:00.000Z".to_string(),
        }
    }

    fn ctx_with_permissions(permissions: &[&str]) -> InventoryRequestContext {
        InventoryRequestContext {
            company_id: "default-org".to_string(),
            tenant_id: "default-org".to_string(),
            user_id: "user-1".to_string(),
            request_id: "req-1".to_string(),
            role: "COMPANY_OWNER".to_string(),
            user_level: 4,
            permissions: permissions
                .iter()
                .map(|value| (*value).to_string())
                .collect(),
        }
    }

    #[test]
    fn stock_settings_validation_accepts_valid_payload() {
        let payload = valid_settings();
        assert!(validate_stock_settings(&payload).is_ok());
    }

    #[test]
    fn stock_settings_validation_rejects_invalid_ranges_and_enums() {
        let mut payload = valid_settings();
        payload.over_delivery_receipt_allowance_pct = 101.0;
        payload.over_transfer_allowance_pct = -1.0;
        payload.freeze_stocks_older_than_days = -5;
        payload.default_valuation_method = "INVALID".to_string();

        let errors = validate_stock_settings(&payload).expect_err("validation should fail");
        assert!(
            errors
                .iter()
                .any(|value| value.contains("over_delivery_receipt_allowance_pct")),
            "expected over_delivery_receipt_allowance_pct error"
        );
        assert!(
            errors
                .iter()
                .any(|value| value.contains("over_transfer_allowance_pct")),
            "expected over_transfer_allowance_pct error"
        );
        assert!(
            errors
                .iter()
                .any(|value| value.contains("freeze_stocks_older_than_days")),
            "expected freeze_stocks_older_than_days error"
        );
        assert!(
            errors
                .iter()
                .any(|value| value.contains("default_valuation_method")),
            "expected default_valuation_method enum error"
        );
    }

    #[test]
    fn if_match_header_is_parsed_as_integer() {
        let mut headers = HeaderMap::new();
        headers.insert("if-match", HeaderValue::from_static("\"42\""));
        assert_eq!(parse_if_match(&headers), Some(42));
    }

    #[test]
    fn settings_write_permission_requires_level_4_or_higher() {
        let mut denied = ctx_with_permissions(&["inventory.settings.write"]);
        denied.user_level = 3;
        assert!(!has_stock_settings_write_permission(&denied));

        let mut allowed = ctx_with_permissions(&[]);
        allowed.user_level = 4;
        assert!(has_stock_settings_write_permission(&allowed));
    }

    #[test]
    fn settings_write_permission_allows_master_level_without_explicit_permission() {
        let mut ctx = ctx_with_permissions(&[]);
        ctx.user_level = 5;
        assert!(has_stock_settings_write_permission(&ctx));
    }

    async fn maybe_pool() -> Option<PgPool> {
        let database_url = match std::env::var("DATABASE_URL") {
            Ok(value) => value,
            Err(_) => return None,
        };
        PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .ok()
    }

    #[tokio::test]
    async fn stock_settings_db_flow_respects_version_updates() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        let company_id = format!("stock-settings-test-{}", Uuid::new_v4());
        let user_id = "stock-settings-test-user";

        let initial = match get_or_create_stock_settings_row(&pool, &company_id, user_id).await {
            Ok(row) => row,
            Err(_) => return,
        };
        let initial_view = row_to_stock_settings(&initial);

        let mut next = initial_view.clone();
        next.allow_negative_stock = !initial_view.allow_negative_stock;

        let updated = match update_stock_settings_row(
            &pool,
            &company_id,
            user_id,
            initial_view.version,
            &next,
        )
        .await
        {
            Ok(Some(row)) => row_to_stock_settings(&row),
            Ok(None) => {
                let _ = sqlx::query(r#"DELETE FROM "InventoryCompanySetting" WHERE "orgId" = $1"#)
                    .bind(&company_id)
                    .execute(&pool)
                    .await;
                panic!("expected successful update row");
            }
            Err(_) => {
                let _ = sqlx::query(r#"DELETE FROM "InventoryCompanySetting" WHERE "orgId" = $1"#)
                    .bind(&company_id)
                    .execute(&pool)
                    .await;
                return;
            }
        };

        assert_eq!(updated.version, initial_view.version + 1);
        assert_eq!(updated.allow_negative_stock, next.allow_negative_stock);

        let stale =
            update_stock_settings_row(&pool, &company_id, user_id, initial_view.version, &next)
                .await
                .ok()
                .flatten();
        assert!(stale.is_none());

        let _ = sqlx::query(
            r#"DELETE FROM "InventoryAuditLog" WHERE "companyId" = $1 AND "action" = 'STOCK_SETTINGS_UPDATED'"#,
        )
        .bind(&company_id)
        .execute(&pool)
        .await;
        let _ = sqlx::query(r#"DELETE FROM "InventoryCompanySetting" WHERE "orgId" = $1"#)
            .bind(&company_id)
            .execute(&pool)
            .await;
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

    let bind_addr = env::var("RUST_API_BIND")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            env::var("PORT")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .map(|port| format!("0.0.0.0:{port}"))
        })
        .unwrap_or_else(|| "0.0.0.0:4000".to_string());
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
