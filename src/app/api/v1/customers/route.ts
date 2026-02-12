import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiKeyAuthError, appendApiKeyCompatibilityHeaders, authenticateApiKeyRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

const createCustomerSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  address: z.string().max(512).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKeyRequest(request, "v1_customers_get");
    const customers = await prisma.customer.findMany({
      where: { companyId: auth.companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const response = NextResponse.json({ data: customers });
    appendApiKeyCompatibilityHeaders(response.headers, auth);
    return response;
  } catch (error) {
    if (error instanceof ApiKeyAuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKeyRequest(request, "v1_customers_post");
    const payload = createCustomerSchema.safeParse(await request.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "VALIDATION_ERROR", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const customer = await prisma.customer.create({
      data: {
        companyId: auth.companyId,
        name: payload.data.name,
        email: payload.data.email ?? null,
        phone: payload.data.phone ?? null,
        address: payload.data.address ?? null,
      },
    });

    const response = NextResponse.json({ data: customer });
    appendApiKeyCompatibilityHeaders(response.headers, auth);
    return response;
  } catch (error) {
    if (error instanceof ApiKeyAuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
