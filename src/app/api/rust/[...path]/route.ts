import { NextRequest, NextResponse } from "next/server";

function resolveRustBaseUrl(): string | null {
  const raw = process.env.RUST_API_BASE_URL?.trim();
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function proxyToRust(request: NextRequest, pathSegments: string[]) {
  const baseUrl = resolveRustBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RUST_API_UNAVAILABLE",
          message: "Rust API is not configured",
        },
      },
      { status: 503 },
    );
  }

  const upstreamUrl = new URL(`${baseUrl}/${pathSegments.join("/")}`);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("x-rust-proxy", "1");

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RUST_API_PROXY_ERROR",
          message: "Failed to reach Rust API",
          details: error instanceof Error ? error.message : "Unknown upstream failure",
        },
      },
      { status: 502 },
    );
  }
}

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRust(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRust(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRust(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRust(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRust(request, path);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRust(request, path);
}
