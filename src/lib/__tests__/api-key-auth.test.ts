import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginAttemptCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    iamLoginAttempt: {
      create: mocks.loginAttemptCreate,
    },
  },
}));

import { authenticateApiKeyRequest } from "@/lib/api-key-auth";

function makeRequest(input: {
  authorization?: string;
  xApiKey?: string;
  companyId?: string;
  query?: string;
} = {}): Request {
  const headers = new Headers();
  if (input.authorization) {
    headers.set("authorization", input.authorization);
  }
  if (input.xApiKey) {
    headers.set("x-api-key", input.xApiKey);
  }
  if (input.companyId) {
    headers.set("x-company-id", input.companyId);
  }

  const suffix = input.query ? `?${input.query}` : "";
  return new Request(`http://localhost/api/v1/customers${suffix}`, { headers });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  mocks.loginAttemptCreate.mockReset();
  mocks.loginAttemptCreate.mockResolvedValue({});
});

describe("api key auth", () => {
  it("binds requests to the configured API_ORG_ID", async () => {
    vi.stubEnv("API_KEY", "secret-1");
    vi.stubEnv("API_ORG_ID", "company-1");

    const result = await authenticateApiKeyRequest(
      makeRequest({ authorization: "Bearer secret-1" }),
      "test-scope",
    );

    expect(result.companyId).toBe("company-1");
    expect(result.source).toBe("authorization");
  });

  it("rejects caller-supplied company overrides", async () => {
    vi.stubEnv("API_KEY", "secret-1");
    vi.stubEnv("API_ORG_ID", "company-1");

    await expect(
      authenticateApiKeyRequest(
        makeRequest({ authorization: "Bearer secret-1", companyId: "company-2" }),
        "test-scope",
      ),
    ).rejects.toMatchObject({
      code: "INVALID_COMPANY_CONTEXT",
      status: 403,
    });
  });

  it("blocks query-string API keys unless explicitly re-enabled", async () => {
    vi.stubEnv("API_KEY", "secret-1");

    await expect(
      authenticateApiKeyRequest(
        makeRequest({ query: "apiKey=secret-1" }),
        "test-scope",
      ),
    ).rejects.toMatchObject({
      code: "QUERY_TRANSPORT_DISABLED",
      status: 401,
    });

    expect(mocks.loginAttemptCreate).toHaveBeenCalledTimes(1);
  });
});
