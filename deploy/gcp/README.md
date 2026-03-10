# miniERP Google Cloud Deployment

## Prerequisites

- A billing-enabled Google Cloud project. The current default is `sara-agro-9` in `asia-southeast1`.
- `gcloud` authenticated on the deployment machine.
- The deployment machine must be able to run `gcloud builds submit`.
- If you use the provided VM, repair its home ownership first:

```bash
sudo chown -R "$(id -un):$(id -gn)" "$HOME"
```

## First-time bootstrap

- Review `deploy/gcp/env.example` and set the values you need to override.
- Run bootstrap from the repo root:

```bash
bash deploy/gcp/bootstrap.sh
```

- Bootstrap will:
  - validate `gcloud` auth and project selection
  - enable required APIs
  - create Artifact Registry if needed
  - create the Cloud Run service account if needed
  - create the VPC, subnet, and private service access range if needed
  - create Cloud SQL PostgreSQL and Memorystore Redis if needed
  - create or update the database password secret

## Deploy or update

```bash
bash deploy/gcp/deploy.sh
```

- Deploy will:
  - build and push the Node and Rust images to Artifact Registry
  - create or update Secret Manager secrets
  - deploy the Rust API first
  - deploy the web service, resolve its URL, and redeploy with the final public base URL when needed
  - deploy the IAM and inventory worker services
  - create or update the Prisma migration job and execute it
  - skip seeding by default because the checked-in seed flow provisions demo tenants and users
  - print service URLs and run health checks

## Rollback basics

- List service revisions:

```bash
gcloud run revisions list --service=minierp-web --region=asia-southeast1
```

- Shift traffic back to a previous revision:

```bash
gcloud run services update-traffic minierp-web \
  --region=asia-southeast1 \
  --to-revisions REVISION_NAME=100
```

- Update the migration job back to a previous image if needed:

```bash
gcloud run jobs update minierp-prisma-migrate \
  --region=asia-southeast1 \
  --image=PREVIOUS_IMAGE_URI
```

## Logs

```bash
gcloud run services logs read minierp-web --region=asia-southeast1 --limit=50
gcloud run services logs read minierp-rust-api --region=asia-southeast1 --limit=50
gcloud run services logs read minierp-iam-worker --region=asia-southeast1 --limit=50
gcloud run services logs read minierp-inventory-worker --region=asia-southeast1 --limit=50
gcloud run jobs executions list --job=minierp-prisma-migrate --region=asia-southeast1
```

## Values to customize

- Set `WEB_PUBLIC_BASE_URL` when you have a custom domain. If left blank, the deploy script uses the Cloud Run URL.
- Set OAuth, Turnstile, Resend, Twilio, and API key variables only if those features are enabled.
- Set `SESSION_COOKIE_DOMAIN` only when you need cookies shared across subdomains.
- Set `INVENTORY_STORAGE_PUBLIC_BASE_URL` or `S3_PUBLIC_BASE_URL` to a real S3-compatible object store endpoint if attachment uploads must work.

## Storage gap

- The current attachment flow still uses signed URLs built from an S3-compatible public base URL.
- This deployment does not add a fake Google Cloud Storage layer.
- The rest of the application can run on Cloud Run without that refactor.

## TODO for future GCS refactor

- Replace the URL signing logic in `src/modules/inventory/infrastructure/storage.ts` with GCS signed URL generation.
- Update inventory attachment finalize/download flows to align with GCS object metadata and bucket layout.
- Update trade finance attachment flows that reuse the same storage abstraction so they stop depending on S3-style public object URLs.
