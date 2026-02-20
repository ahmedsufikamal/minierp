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
      { source: "/inventory", destination: "/stock/overview", permanent: false },
      { source: "/inventory/items", destination: "/stock/items", permanent: false },
      { source: "/inventory/warehouses", destination: "/stock/warehouses", permanent: false },
      { source: "/inventory/documents", destination: "/stock/documents", permanent: false },
      { source: "/inventory/ledger", destination: "/stock/ledger", permanent: false },
      { source: "/inventory/reorder", destination: "/stock/reorder", permanent: false },
      { source: "/inventory/settings", destination: "/stock/settings", permanent: false },
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
