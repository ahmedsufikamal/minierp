import { NextResponse } from "next/server";
import { ApiKeyAuthError, appendApiKeyCompatibilityHeaders, authenticateApiKeyRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKeyRequest(request, "v1_products_get");
    const products = await prisma.product.findMany({
      where: { companyId: auth.companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const response = NextResponse.json({ data: products });
    appendApiKeyCompatibilityHeaders(response.headers, auth);
    return response;
  } catch (error) {
    if (error instanceof ApiKeyAuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
