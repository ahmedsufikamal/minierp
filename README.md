# miniERP (Next.js + Custom IAM + Prisma) — Ubuntu 24.04 LTS ready

This is a clean, modern mini-ERP starter built with:

- Next.js App Router
- Custom IAM authentication (multi-tenant organizations, RBAC, MFA, OTP, magic links, OAuth)
- Prisma ORM (Prisma 7 config-first)
- PostgreSQL
- Tailwind CSS v4

## Features (MVP)

- Customers
- Vendors
- Products
- Invoices (with line items)
- Bills (with line items)
- Inventory moves (simple stock snapshot)
- Accounting: Chart of accounts + basic journal (simple debit/credit entry)

---

## Inventory import

The inventory module supports Excel imports based on the SIEMENS stock format, including the cleaned template with a `Brand` column.

- **Import modes:** `OPENING_ONLY` (default) and `HISTORY_APPROX`
- **Idempotency:** a SHA-256 file hash + `companyId` is stored in `InventorySnapshot`. Re-importing the same file is blocked unless `force re-import` is selected.
- **Force re-import:** creates reversal ledger entries and re-applies the new opening balances in the same snapshot.
- **Locations:** the optional `Stock Item Location & Qty` sheet is parsed to create per-location balances; reconciliation warnings are stored when totals don’t match.

Rollback uses reversal entries (`StockLedgerTxnType.REVERSAL`) to keep ledger history intact.

---

## 1) Prerequisites (Ubuntu 24.04.3 LTS)

### Install Node.js (recommended Node 22 LTS)

Use NodeSource or your preferred method.

### Install PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

Create DB + user:

```bash
sudo -u postgres psql
```

Inside psql:

```sql
CREATE USER minierp_user WITH PASSWORD 'CHANGE_ME_STRONG';
CREATE DATABASE minierp OWNER minierp_user;
\q
```

---

## 2) IAM setup

See `README-iam.md` for full end-to-end identity and access setup, including OAuth, MFA, OTP, organization settings, and admin console.

---

## 3) Configure environment variables

Create `.env` in project root:

```env
# Postgres
DATABASE_URL="postgresql://minierp_user:CHANGE_ME_STRONG@127.0.0.1:5432/minierp?schema=public"

# IAM (see README-iam.md for full list)
IAM_V2_ENABLED=1
IAM_PROVIDER=local
IAM_TOKEN_HASH_SECRET="replace-with-long-secret"
IAM_ENCRYPTION_SECRET="replace-with-long-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
IAM_LEGACY_FALLBACK_ENABLED=1
IAM_DUAL_WRITE_LEGACY_SESSION=1
IAM_LEGACY_FALLBACK_SUNSET_DAYS=30
IAM_INVITE_SIGNUP_BRIDGE_ENABLED=1
IAM_INVENTORY_PERMISSION_SYNC_ENABLED=1
```

> Prisma 7 uses `prisma.config.ts` to read DATABASE_URL (config-first).
> The `datasource db { url = env(...) }` is intentionally removed from `schema.prisma`.

---

## 4) Install dependencies & initialize DB

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
```

---

## 5) Run the app

```bash
npm run dev
```

Open:

- http://localhost:3000

---

## 6) Quality gates (must pass before deploy)

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

CI workflow is defined at `.github/workflows/ci.yml` and includes migration safety checks.

---

## 7) Production (simple, VM-friendly)

Build:

```bash
npm run build
```

Run:

```bash
npm start
```

### Optional: systemd service

Create `/etc/systemd/system/minierp.service`:

```ini
[Unit]
Description=miniERP Next.js
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/minierp
Environment=NODE_ENV=production
EnvironmentFile=/home/ubuntu/minierp/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now minierp
sudo systemctl status minierp
```

---

## Notes

- Auth protection is in `src/proxy.ts` (Next.js 16 middleware replacement).
- IAM module docs: `README-iam.md`.
