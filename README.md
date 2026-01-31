# miniERP (Next.js + Clerk + Prisma) — Ubuntu 24.04 LTS ready

This is a clean, modern mini-ERP starter built with:

- Next.js App Router
- Clerk authentication (supports Organizations for multi-tenant)
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

## 2) Clerk setup

1. Create a Clerk application
2. Copy the keys into `.env` (see below)
3. (Optional) Enable Organizations in Clerk if you want multi-tenant separation

---

## 3) Configure environment variables

Create `.env` in project root:

```env
# Postgres
DATABASE_URL="postgresql://minierp_user:CHANGE_ME_STRONG@127.0.0.1:5432/minierp?schema=public"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Optional Clerk routes
CLERK_SIGN_IN_URL="/sign-in"
CLERK_SIGN_UP_URL="/sign-up"
CLERK_AFTER_SIGN_IN_URL="/dashboard"
CLERK_AFTER_SIGN_UP_URL="/dashboard"
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

## 6) Production (simple, VM-friendly)

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
- If you want “single-tenant” only, keep Organizations disabled; the app falls back to `userId` as tenant id.
