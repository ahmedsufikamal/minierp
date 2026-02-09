import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return new URL(request.url).searchParams.get("apiKey");
}

function isAuthorized(request: Request): boolean {
  const key = process.env.API_KEY;
  if (!key) return false;
  return getApiKey(request) === key;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = process.env.API_ORG_ID ?? "default-org";
  const customers = await prisma.customer.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: customers });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = process.env.API_ORG_ID ?? "default-org";
  const body = await request.json();
  const { name, email, phone, address } = body;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const customer = await prisma.customer.create({
    data: {
      companyId,
      name,
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
    },
  });
  return NextResponse.json({ data: customer });
}
