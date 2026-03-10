#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEFAULT_ENV_FILE="$SCRIPT_DIR/.env.gcp"
if [[ ! -f "$DEFAULT_ENV_FILE" ]]; then
  DEFAULT_ENV_FILE="$SCRIPT_DIR/env.example"
fi
ENV_FILE="${1:-$DEFAULT_ENV_FILE}"
PRESET_IMAGE_TAG="${IMAGE_TAG-}"
PRESET_BUILD_MACHINE_TYPE="${BUILD_MACHINE_TYPE-}"
PRESET_SKIP_IMAGE_BUILD="${SKIP_IMAGE_BUILD-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -n "$PRESET_IMAGE_TAG" ]]; then
  IMAGE_TAG="$PRESET_IMAGE_TAG"
fi
if [[ -n "$PRESET_BUILD_MACHINE_TYPE" ]]; then
  BUILD_MACHINE_TYPE="$PRESET_BUILD_MACHINE_TYPE"
fi
if [[ -n "$PRESET_SKIP_IMAGE_BUILD" ]]; then
  SKIP_IMAGE_BUILD="$PRESET_SKIP_IMAGE_BUILD"
fi

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-southeast1}"
ARTIFACT_REPO="${ARTIFACT_REPO:-minierp}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-minierp-cloud-run}"
NETWORK_NAME="${NETWORK_NAME:-minierp-vpc}"
SUBNET_NAME="${SUBNET_NAME:-minierp-asia-southeast1}"
DB_INSTANCE_NAME="${DB_INSTANCE_NAME:-minierp-pg}"
DB_NAME="${DB_NAME:-minierp}"
DB_USER="${DB_USER:-minierp_app}"
REDIS_INSTANCE_NAME="${REDIS_INSTANCE_NAME:-minierp-redis}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-minierp-web}"
RUST_SERVICE_NAME="${RUST_SERVICE_NAME:-minierp-rust-api}"
IAM_WORKER_SERVICE_NAME="${IAM_WORKER_SERVICE_NAME:-minierp-iam-worker}"
INVENTORY_WORKER_SERVICE_NAME="${INVENTORY_WORKER_SERVICE_NAME:-minierp-inventory-worker}"
MIGRATION_JOB_NAME="${MIGRATION_JOB_NAME:-minierp-prisma-migrate}"
NODE_IMAGE_NAME="${NODE_IMAGE_NAME:-minierp-node}"
RUST_IMAGE_NAME="${RUST_IMAGE_NAME:-minierp-rust}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
BUILD_MACHINE_TYPE="${BUILD_MACHINE_TYPE:-e2-highcpu-8}"
SKIP_IMAGE_BUILD="${SKIP_IMAGE_BUILD:-0}"

WEB_CPU="${WEB_CPU:-1}"
WEB_MEMORY="${WEB_MEMORY:-1Gi}"
WEB_MIN_INSTANCES="${WEB_MIN_INSTANCES:-1}"
WEB_MAX_INSTANCES="${WEB_MAX_INSTANCES:-10}"
RUST_CPU="${RUST_CPU:-1}"
RUST_MEMORY="${RUST_MEMORY:-512Mi}"
RUST_MIN_INSTANCES="${RUST_MIN_INSTANCES:-0}"
RUST_MAX_INSTANCES="${RUST_MAX_INSTANCES:-5}"
WORKER_CPU="${WORKER_CPU:-1}"
WORKER_MEMORY="${WORKER_MEMORY:-512Mi}"
MIGRATION_CPU="${MIGRATION_CPU:-1}"
MIGRATION_MEMORY="${MIGRATION_MEMORY:-512Mi}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is required." >&2
  exit 1
fi

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
NODE_IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${NODE_IMAGE_NAME}:${IMAGE_TAG}"
RUST_IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${RUST_IMAGE_NAME}:${IMAGE_TAG}"

print_cmd() {
  printf '+' >&2
  for arg in "$@"; do
    printf ' %q' "$arg" >&2
  done
  printf '\n' >&2
}

run_cmd() {
  print_cmd "$@"
  "$@"
}

join_by_comma() {
  local IFS=','
  echo "$*"
}

secret_exists() {
  gcloud secrets describe "$1" --project "$PROJECT_ID" >/dev/null 2>&1
}

read_secret() {
  gcloud secrets versions access latest --secret "$1" --project "$PROJECT_ID"
}

read_recent_text_logs() {
  local service_name="$1"
  gcloud logging read \
    "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${service_name}\"" \
    --project "$PROJECT_ID" \
    --limit 50 \
    --format='value(textPayload)'
}

upsert_secret_value() {
  local name="$1"
  local value="$2"

  if ! secret_exists "$name"; then
    run_cmd gcloud secrets create "$name" \
      --project "$PROJECT_ID" \
      --replication-policy automatic >/dev/null
  fi

  print_cmd gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file=-
  printf '%s' "$value" | gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file=- >/dev/null
}

ensure_secret_value() {
  local name="$1"
  local min_length="${2:-1}"
  local current="${!name:-}"

  if [[ -z "$current" ]] && secret_exists "$name"; then
    current="$(read_secret "$name")"
  fi

  if [[ -z "$current" ]]; then
    current="$(openssl rand -base64 48 | tr -d '\n')"
  fi

  if (( ${#current} < min_length )); then
    echo "Secret $name must be at least ${min_length} characters." >&2
    exit 1
  fi

  upsert_secret_value "$name" "$current"
  printf '%s' "$current"
}

maybe_upsert_secret_from_env() {
  local name="$1"
  local current="${!name:-}"
  if [[ -n "$current" ]]; then
    upsert_secret_value "$name" "$current"
  fi
}

check_worker_logs() {
  local service_name="$1"
  local wrapper_pattern="$2"
  local worker_pattern="$3"
  local logs

  logs="$(read_recent_text_logs "$service_name")"

  if ! grep -Fq "$wrapper_pattern" <<<"$logs"; then
    echo "Missing worker health listener log for ${service_name}: ${wrapper_pattern}" >&2
    exit 1
  fi

  if ! grep -Fq "$worker_pattern" <<<"$logs"; then
    echo "Missing worker queue startup log for ${service_name}: ${worker_pattern}" >&2
    exit 1
  fi
}

append_if_set() {
  local array_name="$1"
  local key="$2"
  local value="$3"
  if [[ -n "$value" ]]; then
    eval "$array_name+=(\"\${key}=\${value}\")"
  fi
}

ensure_gcloud_ready() {
  command -v gcloud >/dev/null 2>&1 || {
    echo "gcloud CLI is required." >&2
    exit 1
  }

  if ! gcloud auth print-access-token >/dev/null 2>&1; then
    echo "gcloud is not authenticated. Run 'gcloud auth login' or configure a usable service account on this VM." >&2
    exit 1
  fi

  gcloud config set project "$PROJECT_ID" >/dev/null
}

build_images() {
  if [[ "$SKIP_IMAGE_BUILD" == "1" ]]; then
    echo "Skipping image builds. Using existing tags:"
    echo "  NODE_IMAGE_URI=$NODE_IMAGE_URI"
    echo "  RUST_IMAGE_URI=$RUST_IMAGE_URI"
    return
  fi

  run_cmd gcloud builds submit "$ROOT_DIR" \
    --project "$PROJECT_ID" \
    --machine-type "$BUILD_MACHINE_TYPE" \
    --tag "$NODE_IMAGE_URI"

  run_cmd gcloud builds submit "$ROOT_DIR" \
    --project "$PROJECT_ID" \
    --machine-type "$BUILD_MACHINE_TYPE" \
    --config "$ROOT_DIR/deploy/gcp/cloudbuild.rust.yaml" \
    --substitutions "_IMAGE_URI=$RUST_IMAGE_URI"
}

load_runtime_secrets() {
  DB_PASSWORD_VALUE="$(ensure_secret_value DB_PASSWORD 24)"
  JWT_SECRET_VALUE="$(ensure_secret_value JWT_SECRET 32)"
  IAM_TOKEN_HASH_SECRET_VALUE="$(ensure_secret_value IAM_TOKEN_HASH_SECRET 32)"
  IAM_ENCRYPTION_SECRET_VALUE="$(ensure_secret_value IAM_ENCRYPTION_SECRET 32)"
  INVENTORY_STORAGE_SIGNING_SECRET_VALUE="$(ensure_secret_value INVENTORY_STORAGE_SIGNING_SECRET 32)"
  AUTOMATION_WEBHOOK_SIGNING_SECRET_VALUE="$(ensure_secret_value AUTOMATION_WEBHOOK_SIGNING_SECRET 32)"
  RUST_TRUSTED_PROXY_SECRET_VALUE="$(ensure_secret_value RUST_TRUSTED_PROXY_SECRET 32)"
  INVENTORY_WORKER_TOKEN_VALUE="$(ensure_secret_value INVENTORY_WORKER_TOKEN 32)"

  maybe_upsert_secret_from_env API_KEY
  maybe_upsert_secret_from_env GOOGLE_OAUTH_CLIENT_SECRET
  maybe_upsert_secret_from_env MICROSOFT_OAUTH_CLIENT_SECRET
  maybe_upsert_secret_from_env RESEND_API_KEY
  maybe_upsert_secret_from_env TURNSTILE_SECRET_KEY
  maybe_upsert_secret_from_env TWILIO_ACCOUNT_SID
  maybe_upsert_secret_from_env TWILIO_AUTH_TOKEN
}

load_infra_addresses() {
  DB_HOST="$(gcloud sql instances describe "$DB_INSTANCE_NAME" --project "$PROJECT_ID" --format='value(ipAddresses.ipAddress)' | head -n1)"
  if [[ -z "$DB_HOST" ]]; then
    echo "Failed to resolve Cloud SQL private IP for $DB_INSTANCE_NAME" >&2
    exit 1
  fi

  REDIS_HOST="$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(host)')"
  REDIS_PORT="$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(port)')"
  REDIS_AUTH_TOKEN_VALUE="$(gcloud redis instances get-auth-string "$REDIS_INSTANCE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(authString)')"
  if [[ -z "$REDIS_HOST" || -z "$REDIS_AUTH_TOKEN_VALUE" ]]; then
    echo "Failed to resolve Memorystore connection details for $REDIS_INSTANCE_NAME" >&2
    exit 1
  fi

  DATABASE_URL_VALUE="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD_VALUE}@${DB_HOST}:5432/${DB_NAME}?schema=public}"
  REDIS_URL_VALUE="${REDIS_URL:-redis://:${REDIS_AUTH_TOKEN_VALUE}@${REDIS_HOST}:${REDIS_PORT:-6379}/0}"

  upsert_secret_value DATABASE_URL "$DATABASE_URL_VALUE"
  upsert_secret_value REDIS_URL "$REDIS_URL_VALUE"
}

deploy_rust_service() {
  local env_vars=(
    "NODE_ENV=production"
    "RUST_LOG=${RUST_LOG:-info}"
  )
  local secret_vars=(
    "DATABASE_URL=DATABASE_URL:latest"
    "RUST_TRUSTED_PROXY_SECRET=RUST_TRUSTED_PROXY_SECRET:latest"
  )

  run_cmd gcloud run deploy "$RUST_SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --image "$RUST_IMAGE_URI" \
    --service-account "$SERVICE_ACCOUNT_EMAIL" \
    --network "$NETWORK_NAME" \
    --subnet "$SUBNET_NAME" \
    --vpc-egress private-ranges-only \
    --cpu "$RUST_CPU" \
    --memory "$RUST_MEMORY" \
    --min-instances "$RUST_MIN_INSTANCES" \
    --max-instances "$RUST_MAX_INSTANCES" \
    --concurrency 80 \
    --execution-environment gen2 \
    --no-allow-unauthenticated \
    --set-env-vars "$(join_by_comma "${env_vars[@]}")" \
    --update-secrets "$(join_by_comma "${secret_vars[@]}")"

  run_cmd gcloud run services add-iam-policy-binding "$RUST_SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --member "serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role roles/run.invoker

  RUST_SERVICE_URL="$(gcloud run services describe "$RUST_SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
}

deploy_web_service() {
  local public_base_url="${1:-https://bootstrap.invalid}"
  local automation_allowlist="${AUTOMATION_WEBHOOK_ALLOWLIST:-$public_base_url}"
  local env_vars=(
    "NODE_ENV=production"
    "NEXT_PUBLIC_APP_URL=${public_base_url}"
    "APP_BASE_URL=${public_base_url}"
    "IAM_V2_ENABLED=${IAM_V2_ENABLED:-1}"
    "IAM_PROVIDER=${IAM_PROVIDER:-local}"
    "IAM_REQUIRE_SAME_ORIGIN=${IAM_REQUIRE_SAME_ORIGIN:-1}"
    "IAM_LEGACY_FALLBACK_ENABLED=${IAM_LEGACY_FALLBACK_ENABLED:-0}"
    "IAM_DUAL_WRITE_LEGACY_SESSION=${IAM_DUAL_WRITE_LEGACY_SESSION:-0}"
    "IAM_LEGACY_FALLBACK_SUNSET_DAYS=${IAM_LEGACY_FALLBACK_SUNSET_DAYS:-30}"
    "IAM_INVITE_SIGNUP_BRIDGE_ENABLED=${IAM_INVITE_SIGNUP_BRIDGE_ENABLED:-1}"
    "IAM_INVENTORY_PERMISSION_SYNC_ENABLED=${IAM_INVENTORY_PERMISSION_SYNC_ENABLED:-1}"
    "IAM_MASTER_ADMIN_ENFORCEMENT=${IAM_MASTER_ADMIN_ENFORCEMENT:-1}"
    "IAM_PLATFORM_ROLE_MANAGEMENT=${IAM_PLATFORM_ROLE_MANAGEMENT:-1}"
    "IAM_SELF_SERVE_ORG_CREATION=${IAM_SELF_SERVE_ORG_CREATION:-0}"
    "IAM_NOTIFICATION_PROVIDER=${IAM_NOTIFICATION_PROVIDER:-http}"
    "IAM_QUEUE_PROVIDER=${IAM_QUEUE_PROVIDER:-bullmq}"
    "IAM_QUEUE_NAME=${IAM_QUEUE_NAME:-iam-notifications}"
    "IAM_QUEUE_CONCURRENCY=${IAM_QUEUE_CONCURRENCY:-5}"
    "INVENTORY_QUEUE_PROVIDER=${INVENTORY_QUEUE_PROVIDER:-bullmq}"
    "INVENTORY_QUEUE_NAME=${INVENTORY_QUEUE_NAME:-inventory-ops}"
    "INVENTORY_QUEUE_CONCURRENCY=${INVENTORY_QUEUE_CONCURRENCY:-5}"
    "INVENTORY_ITEMS_RUST_ENABLED=${INVENTORY_ITEMS_RUST_ENABLED:-0}"
    "RUST_API_BASE_URL=${RUST_SERVICE_URL}"
    "RUST_API_IAM_AUTH_ENABLED=${RUST_API_IAM_AUTH_ENABLED:-1}"
    "META_COMPILED_CACHE_TTL_MS=${META_COMPILED_CACHE_TTL_MS:-300000}"
    "META_TEMPLATE_SANITIZE_STRICT=${META_TEMPLATE_SANITIZE_STRICT:-1}"
    "META_EXPORT_MAX_ROWS=${META_EXPORT_MAX_ROWS:-200}"
    "AUTOMATION_WEBHOOK_ALLOWLIST=${automation_allowlist}"
    "AUTOMATION_WEBHOOK_TIMEOUT_MS=${AUTOMATION_WEBHOOK_TIMEOUT_MS:-5000}"
    "AUTOMATION_WEBHOOK_MAX_ATTEMPTS=${AUTOMATION_WEBHOOK_MAX_ATTEMPTS:-3}"
  )

  append_if_set env_vars "SESSION_COOKIE_DOMAIN" "${SESSION_COOKIE_DOMAIN:-}"
  append_if_set env_vars "INVENTORY_STORAGE_PUBLIC_BASE_URL" "${INVENTORY_STORAGE_PUBLIC_BASE_URL:-}"
  append_if_set env_vars "S3_PUBLIC_BASE_URL" "${S3_PUBLIC_BASE_URL:-}"
  append_if_set env_vars "API_ORG_ID" "${API_ORG_ID:-}"
  append_if_set env_vars "API_KEY_QUERY_FALLBACK_ENABLED" "${API_KEY_QUERY_FALLBACK_ENABLED:-}"
  append_if_set env_vars "API_KEY_QUERY_SUNSET_DATE" "${API_KEY_QUERY_SUNSET_DATE:-}"
  append_if_set env_vars "API_ALLOW_DEFAULT_ORG_FALLBACK" "${API_ALLOW_DEFAULT_ORG_FALLBACK:-}"
  append_if_set env_vars "GOOGLE_OAUTH_CLIENT_ID" "${GOOGLE_OAUTH_CLIENT_ID:-}"
  append_if_set env_vars "MICROSOFT_OAUTH_CLIENT_ID" "${MICROSOFT_OAUTH_CLIENT_ID:-}"
  append_if_set env_vars "MICROSOFT_OAUTH_TENANT_ID" "${MICROSOFT_OAUTH_TENANT_ID:-}"
  append_if_set env_vars "RESEND_FROM_EMAIL" "${RESEND_FROM_EMAIL:-}"
  append_if_set env_vars "TWILIO_FROM_PHONE" "${TWILIO_FROM_PHONE:-}"
  append_if_set env_vars "NEXT_PUBLIC_TURNSTILE_SITE_KEY" "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}"
  append_if_set env_vars "IAM_TURNSTILE_ENABLED" "${IAM_TURNSTILE_ENABLED:-}"
  append_if_set env_vars "API_ALLOW_DEFAULT_ORG_FALLBACK" "${API_ALLOW_DEFAULT_ORG_FALLBACK:-}"

  local secret_vars=(
    "DATABASE_URL=DATABASE_URL:latest"
    "REDIS_URL=REDIS_URL:latest"
    "JWT_SECRET=JWT_SECRET:latest"
    "IAM_TOKEN_HASH_SECRET=IAM_TOKEN_HASH_SECRET:latest"
    "IAM_ENCRYPTION_SECRET=IAM_ENCRYPTION_SECRET:latest"
    "INVENTORY_STORAGE_SIGNING_SECRET=INVENTORY_STORAGE_SIGNING_SECRET:latest"
    "AUTOMATION_WEBHOOK_SIGNING_SECRET=AUTOMATION_WEBHOOK_SIGNING_SECRET:latest"
    "RUST_TRUSTED_PROXY_SECRET=RUST_TRUSTED_PROXY_SECRET:latest"
    "INVENTORY_WORKER_TOKEN=INVENTORY_WORKER_TOKEN:latest"
  )

  if secret_exists API_KEY; then
    secret_vars+=("API_KEY=API_KEY:latest")
  fi
  if secret_exists GOOGLE_OAUTH_CLIENT_SECRET; then
    secret_vars+=("GOOGLE_OAUTH_CLIENT_SECRET=GOOGLE_OAUTH_CLIENT_SECRET:latest")
  fi
  if secret_exists MICROSOFT_OAUTH_CLIENT_SECRET; then
    secret_vars+=("MICROSOFT_OAUTH_CLIENT_SECRET=MICROSOFT_OAUTH_CLIENT_SECRET:latest")
  fi
  if secret_exists RESEND_API_KEY; then
    secret_vars+=("RESEND_API_KEY=RESEND_API_KEY:latest")
  fi
  if secret_exists TURNSTILE_SECRET_KEY; then
    secret_vars+=("TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest")
  fi
  if secret_exists TWILIO_ACCOUNT_SID; then
    secret_vars+=("TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest")
  fi
  if secret_exists TWILIO_AUTH_TOKEN; then
    secret_vars+=("TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest")
  fi

  run_cmd gcloud run deploy "$WEB_SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --image "$NODE_IMAGE_URI" \
    --service-account "$SERVICE_ACCOUNT_EMAIL" \
    --network "$NETWORK_NAME" \
    --subnet "$SUBNET_NAME" \
    --vpc-egress private-ranges-only \
    --cpu "$WEB_CPU" \
    --memory "$WEB_MEMORY" \
    --min-instances "$WEB_MIN_INSTANCES" \
    --max-instances "$WEB_MAX_INSTANCES" \
    --concurrency 80 \
    --execution-environment gen2 \
    --allow-unauthenticated \
    --set-env-vars "$(join_by_comma "${env_vars[@]}")" \
    --update-secrets "$(join_by_comma "${secret_vars[@]}")"

  WEB_SERVICE_URL="$(gcloud run services describe "$WEB_SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
}

deploy_worker_service() {
  local service_name="$1"
  local role="$2"
  shift 2
  local env_vars=("$@")
  local secret_vars=("REDIS_URL=REDIS_URL:latest")

  if [[ "$role" == "inventory" ]]; then
    secret_vars+=("INVENTORY_WORKER_TOKEN=INVENTORY_WORKER_TOKEN:latest")
  fi
  if [[ "$role" == "iam" && "$(secret_exists RESEND_API_KEY && echo yes || true)" == "yes" ]]; then
    secret_vars+=("RESEND_API_KEY=RESEND_API_KEY:latest")
  fi
  if [[ "$role" == "iam" && "$(secret_exists TWILIO_ACCOUNT_SID && echo yes || true)" == "yes" ]]; then
    secret_vars+=("TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest")
  fi
  if [[ "$role" == "iam" && "$(secret_exists TWILIO_AUTH_TOKEN && echo yes || true)" == "yes" ]]; then
    secret_vars+=("TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest")
  fi

  run_cmd gcloud run deploy "$service_name" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --image "$NODE_IMAGE_URI" \
    --service-account "$SERVICE_ACCOUNT_EMAIL" \
    --network "$NETWORK_NAME" \
    --subnet "$SUBNET_NAME" \
    --vpc-egress private-ranges-only \
    --cpu "$WORKER_CPU" \
    --memory "$WORKER_MEMORY" \
    --min-instances 1 \
    --max-instances 1 \
    --concurrency 1 \
    --execution-environment gen2 \
    --command node \
    --args scripts/run-worker-service.mjs,"$role" \
    --no-allow-unauthenticated \
    --no-cpu-throttling \
    --set-env-vars "$(join_by_comma "${env_vars[@]}")" \
    --update-secrets "$(join_by_comma "${secret_vars[@]}")"
}

deploy_migration_job() {
  local env_vars=(
    "NODE_ENV=production"
  )
  local secret_vars=(
    "DATABASE_URL=DATABASE_URL:latest"
  )

  if gcloud run jobs describe "$MIGRATION_JOB_NAME" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then
    run_cmd gcloud run jobs update "$MIGRATION_JOB_NAME" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --image "$NODE_IMAGE_URI" \
      --service-account "$SERVICE_ACCOUNT_EMAIL" \
      --network "$NETWORK_NAME" \
      --subnet "$SUBNET_NAME" \
      --vpc-egress private-ranges-only \
      --cpu "$MIGRATION_CPU" \
      --memory "$MIGRATION_MEMORY" \
      --max-retries 0 \
      --parallelism 1 \
      --tasks 1 \
      --command npm \
      --args run,prisma:migrate:deploy \
      --set-env-vars "$(join_by_comma "${env_vars[@]}")" \
      --update-secrets "$(join_by_comma "${secret_vars[@]}")"
  else
    run_cmd gcloud run jobs create "$MIGRATION_JOB_NAME" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --image "$NODE_IMAGE_URI" \
      --service-account "$SERVICE_ACCOUNT_EMAIL" \
      --network "$NETWORK_NAME" \
      --subnet "$SUBNET_NAME" \
      --vpc-egress private-ranges-only \
      --cpu "$MIGRATION_CPU" \
      --memory "$MIGRATION_MEMORY" \
      --max-retries 0 \
      --parallelism 1 \
      --tasks 1 \
      --command npm \
      --args run,prisma:migrate:deploy \
      --set-env-vars "$(join_by_comma "${env_vars[@]}")" \
      --update-secrets "$(join_by_comma "${secret_vars[@]}")"
  fi

  run_cmd gcloud run jobs execute "$MIGRATION_JOB_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --wait
}

read_logs_and_health() {
  local id_token
  id_token="$(gcloud auth print-identity-token)"

  print_cmd curl -fsS "${WEB_SERVICE_URL}/api/health"
  curl -fsS "${WEB_SERVICE_URL}/api/health"

  print_cmd curl -fsS -H "Authorization: Bearer <identity-token>" "${RUST_SERVICE_URL}/api/health"
  curl -fsS -H "Authorization: Bearer ${id_token}" "${RUST_SERVICE_URL}/api/health"

  IAM_WORKER_URL="$(gcloud run services describe "$IAM_WORKER_SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
  INVENTORY_WORKER_URL="$(gcloud run services describe "$INVENTORY_WORKER_SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

  check_worker_logs "$IAM_WORKER_SERVICE_NAME" \
    "[iam-worker-service] health endpoint listening" \
    "[iam-worker] Listening on queue"

  check_worker_logs "$INVENTORY_WORKER_SERVICE_NAME" \
    "[inventory-worker-service] health endpoint listening" \
    "[inventory-worker] Listening on queue"

  gcloud run services logs read "$WEB_SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --limit 30
  gcloud run services logs read "$RUST_SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --limit 30
  gcloud run services logs read "$IAM_WORKER_SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --limit 30
  gcloud run services logs read "$INVENTORY_WORKER_SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --limit 30
  gcloud run jobs executions list --job "$MIGRATION_JOB_NAME" --project "$PROJECT_ID" --region "$REGION" --limit 5
}

print_summary() {
  cat <<EOF
Deployment complete.
NODE_IMAGE_URI=$NODE_IMAGE_URI
RUST_IMAGE_URI=$RUST_IMAGE_URI
WEB_SERVICE_URL=$WEB_SERVICE_URL
RUST_SERVICE_URL=$RUST_SERVICE_URL
IAM_WORKER_URL=$IAM_WORKER_URL
INVENTORY_WORKER_URL=$INVENTORY_WORKER_URL
MIGRATION_JOB_NAME=$MIGRATION_JOB_NAME
EOF
}

cd "$ROOT_DIR"
ensure_gcloud_ready
build_images
load_runtime_secrets
load_infra_addresses
deploy_rust_service
deploy_web_service "${WEB_PUBLIC_BASE_URL:-https://bootstrap.invalid}"

if [[ -z "${WEB_PUBLIC_BASE_URL:-}" ]]; then
  deploy_web_service "$WEB_SERVICE_URL"
fi

deploy_worker_service "$IAM_WORKER_SERVICE_NAME" iam \
  "NODE_ENV=production" \
  "IAM_QUEUE_NAME=${IAM_QUEUE_NAME:-iam-notifications}" \
  "IAM_QUEUE_CONCURRENCY=${IAM_QUEUE_CONCURRENCY:-5}" \
  "IAM_WORKER_VERBOSE=${IAM_WORKER_VERBOSE:-0}" \
  "IAM_NOTIFICATION_PROVIDER=${IAM_NOTIFICATION_PROVIDER:-http}" \
  "RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL:-}" \
  "TWILIO_FROM_PHONE=${TWILIO_FROM_PHONE:-}"

deploy_worker_service "$INVENTORY_WORKER_SERVICE_NAME" inventory \
  "NODE_ENV=production" \
  "INVENTORY_QUEUE_NAME=${INVENTORY_QUEUE_NAME:-inventory-ops}" \
  "INVENTORY_QUEUE_CONCURRENCY=${INVENTORY_QUEUE_CONCURRENCY:-5}" \
  "INVENTORY_WORKER_VERBOSE=${INVENTORY_WORKER_VERBOSE:-0}" \
  "APP_BASE_URL=${WEB_PUBLIC_BASE_URL:-$WEB_SERVICE_URL}" \
  "INVENTORY_WORKER_API_BASE_URL=${WEB_PUBLIC_BASE_URL:-$WEB_SERVICE_URL}"

deploy_migration_job
read_logs_and_health
print_summary
