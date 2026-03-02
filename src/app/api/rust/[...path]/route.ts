import { NextResponse } from "next/server";

function disabledResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "RUST_API_ROUTE_DISABLED",
        message: "Generic Rust proxying is disabled; use dedicated server-side proxies instead",
      },
    },
    { status: 404 },
  );
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}

export async function PUT() {
  return disabledResponse();
}

export async function PATCH() {
  return disabledResponse();
}

export async function DELETE() {
  return disabledResponse();
}

export async function OPTIONS() {
  return disabledResponse();
}
