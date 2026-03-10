#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEFAULT_ENV_FILE="$SCRIPT_DIR/.env.gcp"
if [[ ! -f "$DEFAULT_ENV_FILE" ]]; then
  DEFAULT_ENV_FILE="$SCRIPT_DIR/env.example"
fi
ENV_FILE="${1:-$DEFAULT_ENV_FILE}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-southeast1}"
ARTIFACT_REPO="${ARTIFACT_REPO:-minierp}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-minierp-cloud-run}"
NETWORK_NAME="${NETWORK_NAME:-minierp-vpc}"
SUBNET_NAME="${SUBNET_NAME:-minierp-asia-southeast1}"
SUBNET_CIDR="${SUBNET_CIDR:-10.10.0.0/24}"
PRIVATE_SERVICE_RANGE_NAME="${PRIVATE_SERVICE_RANGE_NAME:-minierp-private-services}"
PRIVATE_SERVICE_RANGE_ADDRESS="${PRIVATE_SERVICE_RANGE_ADDRESS:-10.20.0.0}"
PRIVATE_SERVICE_RANGE_PREFIX_LENGTH="${PRIVATE_SERVICE_RANGE_PREFIX_LENGTH:-16}"
DB_INSTANCE_NAME="${DB_INSTANCE_NAME:-minierp-pg}"
DB_NAME="${DB_NAME:-minierp}"
DB_USER="${DB_USER:-minierp_app}"
DB_TIER="${DB_TIER:-db-custom-2-7680}"
DB_STORAGE_SIZE_GB="${DB_STORAGE_SIZE_GB:-100}"
DB_BACKUP_START_TIME="${DB_BACKUP_START_TIME:-03:00}"
DB_AVAILABILITY_TYPE="${DB_AVAILABILITY_TYPE:-REGIONAL}"
REDIS_INSTANCE_NAME="${REDIS_INSTANCE_NAME:-minierp-redis}"
REDIS_TIER="${REDIS_TIER:-standard-ha}"
REDIS_SIZE_GB="${REDIS_SIZE_GB:-1}"
REDIS_VERSION="${REDIS_VERSION:-redis_7_2}"
REDIS_ZONE="${REDIS_ZONE:-${REGION}-a}"
REDIS_ALTERNATIVE_ZONE="${REDIS_ALTERNATIVE_ZONE:-${REGION}-b}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is required." >&2
  exit 1
fi

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

print_cmd() {
  printf '+'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'
}

run_cmd() {
  print_cmd "$@"
  "$@"
}

secret_exists() {
  gcloud secrets describe "$1" --project "$PROJECT_ID" >/dev/null 2>&1
}

upsert_secret_value() {
  local name="$1"
  local value="$2"

  if ! secret_exists "$name"; then
    run_cmd gcloud secrets create "$name" \
      --project "$PROJECT_ID" \
      --replication-policy automatic
  fi

  print_cmd gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file=-
  printf '%s' "$value" | gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file=-
}

ensure_secret_value() {
  local name="$1"
  local min_length="${2:-1}"
  local current="${!name:-}"

  if [[ -z "$current" ]] && secret_exists "$name"; then
    current="$(gcloud secrets versions access latest --secret "$name" --project "$PROJECT_ID")"
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

ensure_home_writable() {
  if [[ -w "$HOME" ]]; then
    return
  fi

  run_cmd sudo chown -R "$(id -un):$(id -gn)" "$HOME"
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

enable_apis() {
  run_cmd gcloud services enable \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    compute.googleapis.com \
    iam.googleapis.com \
    redis.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    servicenetworking.googleapis.com \
    sqladmin.googleapis.com \
    --project "$PROJECT_ID"
}

ensure_artifact_repo() {
  if gcloud artifacts repositories describe "$ARTIFACT_REPO" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
    return
  fi

  run_cmd gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format docker \
    --location "$REGION" \
    --description "miniERP Cloud Run images" \
    --project "$PROJECT_ID"
}

ensure_service_account() {
  if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
      --display-name "miniERP Cloud Run runtime" \
      --project "$PROJECT_ID"
  fi

  local roles=(
    roles/artifactregistry.reader
    roles/logging.logWriter
    roles/monitoring.metricWriter
    roles/secretmanager.secretAccessor
  )

  local member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}"
  local role
  for role in "${roles[@]}"; do
    run_cmd gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member "$member" \
      --role "$role" \
      --quiet
  done
}

ensure_network() {
  if ! gcloud compute networks describe "$NETWORK_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud compute networks create "$NETWORK_NAME" \
      --subnet-mode custom \
      --project "$PROJECT_ID"
  fi

  if ! gcloud compute networks subnets describe "$SUBNET_NAME" --region "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud compute networks subnets create "$SUBNET_NAME" \
      --network "$NETWORK_NAME" \
      --region "$REGION" \
      --range "$SUBNET_CIDR" \
      --enable-private-ip-google-access \
      --project "$PROJECT_ID"
  fi
}

ensure_private_service_access() {
  if ! gcloud compute addresses describe "$PRIVATE_SERVICE_RANGE_NAME" --global --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud compute addresses create "$PRIVATE_SERVICE_RANGE_NAME" \
      --global \
      --purpose VPC_PEERING \
      --addresses "$PRIVATE_SERVICE_RANGE_ADDRESS" \
      --prefix-length "$PRIVATE_SERVICE_RANGE_PREFIX_LENGTH" \
      --network "$NETWORK_NAME" \
      --project "$PROJECT_ID"
  fi

  if ! gcloud services vpc-peerings list \
    --network "$NETWORK_NAME" \
    --service servicenetworking.googleapis.com \
    --project "$PROJECT_ID" \
    --format='value(network)' | grep -q "^${NETWORK_NAME}$"; then
    run_cmd gcloud services vpc-peerings connect \
      --service servicenetworking.googleapis.com \
      --ranges "$PRIVATE_SERVICE_RANGE_NAME" \
      --network "$NETWORK_NAME" \
      --project "$PROJECT_ID"
  fi
}

ensure_cloud_sql() {
  if gcloud sql instances describe "$DB_INSTANCE_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
    return
  fi

  local deletion_flag=()
  if [[ "${DB_DELETION_PROTECTION:-true}" == "true" ]]; then
    deletion_flag=(--deletion-protection)
  fi

  run_cmd gcloud sql instances create "$DB_INSTANCE_NAME" \
    --database-version POSTGRES_16 \
    --region "$REGION" \
    --tier "$DB_TIER" \
    --storage-type SSD \
    --storage-size "$DB_STORAGE_SIZE_GB" \
    --storage-auto-increase \
    --availability-type "$DB_AVAILABILITY_TYPE" \
    --backup-start-time "$DB_BACKUP_START_TIME" \
    --enable-point-in-time-recovery \
    --network "projects/${PROJECT_ID}/global/networks/${NETWORK_NAME}" \
    --no-assign-ip \
    "${deletion_flag[@]}" \
    --project "$PROJECT_ID"
}

ensure_database_and_user() {
  if ! gcloud sql databases describe "$DB_NAME" --instance "$DB_INSTANCE_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud sql databases create "$DB_NAME" \
      --instance "$DB_INSTANCE_NAME" \
      --project "$PROJECT_ID"
  fi

  local db_password
  db_password="$(ensure_secret_value DB_PASSWORD 24)"

  if gcloud sql users list --instance "$DB_INSTANCE_NAME" --project "$PROJECT_ID" --format='value(name)' | grep -qx "$DB_USER"; then
    run_cmd gcloud sql users set-password "$DB_USER" \
      --instance "$DB_INSTANCE_NAME" \
      --password "$db_password" \
      --project "$PROJECT_ID"
  else
    run_cmd gcloud sql users create "$DB_USER" \
      --instance "$DB_INSTANCE_NAME" \
      --password "$db_password" \
      --project "$PROJECT_ID"
  fi
}

ensure_redis() {
  if gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
    return
  fi

  local zone_flags=(--zone "$REDIS_ZONE")
  if [[ "$REDIS_TIER" == "standard-ha" ]]; then
    zone_flags+=(--alternative-zone "$REDIS_ALTERNATIVE_ZONE")
  fi

  run_cmd gcloud redis instances create "$REDIS_INSTANCE_NAME" \
    --region "$REGION" \
    --tier "$REDIS_TIER" \
    --size "$REDIS_SIZE_GB" \
    --redis-version "$REDIS_VERSION" \
    --network "$NETWORK_NAME" \
    --connect-mode private-service-access \
    --auth-enabled \
    "${zone_flags[@]}" \
    --project "$PROJECT_ID"
}

print_outputs() {
  local db_private_ip
  local redis_host

  db_private_ip="$(gcloud sql instances describe "$DB_INSTANCE_NAME" --project "$PROJECT_ID" --format='value(ipAddresses.ipAddress)' | head -n1)"
  redis_host="$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(host)')"

  cat <<EOF
Bootstrap complete.
PROJECT_ID=$PROJECT_ID
REGION=$REGION
ARTIFACT_REPO=$ARTIFACT_REPO
SERVICE_ACCOUNT_EMAIL=$SERVICE_ACCOUNT_EMAIL
NETWORK_NAME=$NETWORK_NAME
SUBNET_NAME=$SUBNET_NAME
DB_INSTANCE_NAME=$DB_INSTANCE_NAME
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PRIVATE_IP=$db_private_ip
REDIS_INSTANCE_NAME=$REDIS_INSTANCE_NAME
REDIS_HOST=$redis_host
EOF
}

cd "$ROOT_DIR"
ensure_home_writable
ensure_gcloud_ready
enable_apis
ensure_artifact_repo
ensure_service_account
ensure_network
ensure_private_service_access
ensure_cloud_sql
ensure_database_and_user
ensure_redis
print_outputs
