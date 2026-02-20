use axum::{extract::State, http::header::HeaderName, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, PgPool};
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
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

#[derive(Clone)]
struct AppState {
    db_pool: Option<PgPool>,
    app_version: String,
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

#[derive(OpenApi)]
#[openapi(
    paths(health, ping),
    components(schemas(HealthResponse, HealthDependencies, PingResponse)),
    tags((name = "system", description = "System and readiness APIs"))
)]
struct ApiDoc;

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

fn build_router(state: Arc<AppState>) -> Router {
    let request_id_header = HeaderName::from_static("x-request-id");

    Router::new()
        .route("/api/health", get(health))
        .route("/api/v1/ping", get(ping))
        .merge(SwaggerUi::new("/docs").url("/openapi.json", ApiDoc::openapi()))
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
        .connect_timeout(std::time::Duration::from_secs(5))
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
    });

    let router = build_router(state);

    info!(%socket_addr, "starting miniERP rust api");

    let listener = tokio::net::TcpListener::bind(socket_addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}
