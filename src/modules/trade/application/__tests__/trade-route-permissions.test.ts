import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformRequestContext: vi.fn(),
  getLcDashboard: vi.fn(),
  listLcs: vi.fn(),
  createLc: vi.fn(),
  approveLc: vi.fn(),
  listTradeLcSettings: vi.fn(),
  updateTradeLcSettings: vi.fn(),
}));

vi.mock("@/modules/platform/interface/context", () => ({
  getPlatformRequestContext: mocks.getPlatformRequestContext,
}));

vi.mock("@/modules/trade/application/lc.service", () => ({
  getLcDashboard: mocks.getLcDashboard,
  listLcs: mocks.listLcs,
  createLc: mocks.createLc,
  approveLc: mocks.approveLc,
}));

vi.mock("@/modules/trade/application/lc-settings.service", () => ({
  listTradeLcSettings: mocks.listTradeLcSettings,
  updateTradeLcSettings: mocks.updateTradeLcSettings,
}));

import { GET as dashboardGet } from "@/app/api/v1/trade/lc/dashboard/route";
import { GET as listGet, POST as createPost } from "@/app/api/v1/trade/lc/route";
import { POST as approvePost } from "@/app/api/v1/trade/lc/[id]/approve/route";
import { GET as settingsGet, PATCH as settingsPatch } from "@/app/api/v1/trade/lc/settings/route";

beforeEach(() => {
  mocks.getPlatformRequestContext.mockResolvedValue({
    requestId: "req-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    userId: "user-1",
    role: "MEMBER",
    platformRole: "NONE",
    permissions: [],
  });
});

afterEach(() => {
  Object.values(mocks).forEach((fn) => fn.mockReset());
});

async function expectForbidden(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  const body = (await response.json()) as { ok: boolean; error?: { code?: string } };
  expect(response.status).toBe(403);
  expect(body.ok).toBe(false);
  expect(body.error?.code).toBe("FORBIDDEN");
}

describe("trade route permission checks", () => {
  it("denies representative LC endpoints without permissions", async () => {
    await expectForbidden(dashboardGet(new Request("http://localhost/api/v1/trade/lc/dashboard")));
    await expectForbidden(listGet(new Request("http://localhost/api/v1/trade/lc")));
    await expectForbidden(
      createPost(
        new Request("http://localhost/api/v1/trade/lc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            beneficiaryVendorId: "vendor-1",
            issuingBankId: "bank-1",
            currency: "USD",
            lcAmount: 100,
            expiryDate: "2026-12-31",
          }),
        }),
      ),
    );
    await expectForbidden(
      approvePost(
        new Request("http://localhost/api/v1/trade/lc/lc-1/approve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: 1 }),
        }),
        { params: Promise.resolve({ id: "lc-1" }) },
      ),
    );
    await expectForbidden(settingsGet(new Request("http://localhost/api/v1/trade/lc/settings")));
    await expectForbidden(
      settingsPatch(
        new Request("http://localhost/api/v1/trade/lc/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dualControlEnabled: true }),
        }),
      ),
    );

    expect(mocks.getLcDashboard).not.toHaveBeenCalled();
    expect(mocks.listLcs).not.toHaveBeenCalled();
    expect(mocks.createLc).not.toHaveBeenCalled();
    expect(mocks.approveLc).not.toHaveBeenCalled();
    expect(mocks.listTradeLcSettings).not.toHaveBeenCalled();
    expect(mocks.updateTradeLcSettings).not.toHaveBeenCalled();
  });
});
