import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data: https:",
  "img-src 'self' data: blob: https:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "connect-src 'self' https: ws: wss:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Strict-Transport-Security",
    value: isProduction ? "max-age=63072000; includeSubDomains; preload" : "max-age=0",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  experimental: {},
  async redirects() {
    return [
      { source: "/customers", destination: "/selling/customers", permanent: false },
      { source: "/quotes", destination: "/selling/quotations", permanent: false },
      { source: "/invoices", destination: "/selling/sales-invoices", permanent: false },
      { source: "/vendors", destination: "/buying/suppliers", permanent: false },
      { source: "/purchase-orders", destination: "/buying/purchase-orders", permanent: false },
      { source: "/bills", destination: "/buying/purchase-invoices", permanent: false },
      { source: "/payments", destination: "/accounting/payment-entries", permanent: false },
      { source: "/inventory", destination: "/stock", permanent: false },
      { source: "/inventory/items/new", destination: "/stock/setup/item/new", permanent: false },
      { source: "/inventory/items/:id", destination: "/stock/setup/item/:id", permanent: false },
      { source: "/inventory/items", destination: "/stock/setup/item", permanent: false },
      {
        source: "/inventory/warehouses/:warehouseId",
        destination: "/stock/setup/warehouse/:warehouseId",
        permanent: false,
      },
      { source: "/inventory/warehouses", destination: "/stock/setup/warehouse", permanent: false },
      {
        source: "/inventory/documents/new",
        destination: "/stock/stock-entry/new",
        permanent: false,
      },
      {
        source: "/inventory/documents/:docId",
        destination: "/stock/stock-entry/:docId",
        permanent: false,
      },
      { source: "/inventory/documents", destination: "/stock/stock-entry", permanent: false },
      { source: "/inventory/ledger", destination: "/stock/reports/stock-ledger", permanent: false },
      {
        source: "/inventory/reorder",
        destination: "/stock/reports/itemwise-recommended-reorder-level",
        permanent: false,
      },
      {
        source: "/inventory/settings",
        destination: "/stock/settings/stock-settings",
        permanent: false,
      },
      { source: "/inventory/brands", destination: "/stock/setup/brand", permanent: false },
      { source: "/stock/items/new", destination: "/stock/setup/item/new", permanent: false },
      { source: "/stock/items", destination: "/stock/setup/item", permanent: false },
      { source: "/stock/documents", destination: "/stock/stock-entry", permanent: false },
      { source: "/stock/ledger", destination: "/stock/reports/stock-ledger", permanent: false },
      {
        source: "/stock/reorder",
        destination: "/stock/reports/itemwise-recommended-reorder-level",
        permanent: false,
      },
      {
        source: "/stock/settings",
        destination: "/stock/settings/stock-settings",
        permanent: false,
      },
      { source: "/stock/warehouses", destination: "/stock/setup/warehouse", permanent: false },
      {
        source: "/stock/admin/repost",
        destination: "/stock/tools/repost-item-valuation",
        permanent: false,
      },
      { source: "/reports", destination: "/platform/reports", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
