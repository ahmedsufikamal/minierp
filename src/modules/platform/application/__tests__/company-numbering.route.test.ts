import { beforeEach, describe, expect, it, vi } from "vitest";
import { platformPermissions } from "@/modules/platform/domain/types";

const mocks = vi.hoisted(() => ({
  getPlatformRequestContext: vi.fn(),
  listCompanyNumberingMasterConfig: vi.fn(),
  updateCompanyNumberingMasterConfig: vi.fn(),
  saveCompanyCodeSettings: vi.fn(),
  previewCompanyNumberingPattern: vi.fn(),
}));

vi.mock("@/modules/platform/interface/context", () => ({
  getPlatformRequestContext: mocks.getPlatformRequestContext,
}));

vi.mock("@/modules/platform/application/company-numbering.service", () => ({
  listCompanyNumberingMasterConfig: mocks.listCompanyNumberingMasterConfig,
  updateCompanyNumberingMasterConfig: mocks.updateCompanyNumberingMasterConfig,
  saveCompanyCodeSettings: mocks.saveCompanyCodeSettings,
  previewCompanyNumberingPattern: mocks.previewCompanyNumberingPattern,
}));

import { GET as companyNumberingGet, PATCH as companyNumberingPatch } from "@/app/api/v1/platform/company-numbering/route";
import { POST as companyNumberingPreviewPost } from "@/app/api/v1/platform/company-numbering/preview/route";

const ctx = {
  requestId: "req-company-numbering",
  tenantId: "tenant-1",
  companyId: "company-1",
  userId: "user-1",
  role: "OWNER",
  platformRole: "NONE" as const,
  permissions: [platformPermissions.numberingRead, platformPermissions.numberingWrite],
};

beforeEach(() => {
  mocks.getPlatformRequestContext.mockResolvedValue(ctx);
  mocks.listCompanyNumberingMasterConfig.mockReset();
  mocks.updateCompanyNumberingMasterConfig.mockReset();
  mocks.saveCompanyCodeSettings.mockReset();
  mocks.previewCompanyNumberingPattern.mockReset();
});

describe("company numbering routes", () => {
  it("returns the rich settings payload from GET", async () => {
    mocks.listCompanyNumberingMasterConfig.mockResolvedValue({
      companyId: "company-1",
      formats: [],
      settings: {
        version: 1,
        companyId: "company-1",
        source: "stored",
        warnings: [],
        definitions: [],
      },
    });

    const response = await companyNumberingGet(new Request("http://localhost/api/v1/platform/company-numbering"));
    const body = (await response.json()) as {
      ok: boolean;
      data: { companyId: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(ctx.requestId);
    expect(body.ok).toBe(true);
    expect(body.data.companyId).toBe("company-1");
    expect(mocks.listCompanyNumberingMasterConfig).toHaveBeenCalledWith(ctx);
  });

  it("dispatches rich SAVE payloads to the structured service path", async () => {
    mocks.saveCompanyCodeSettings.mockResolvedValue({
      companyId: "company-1",
      formats: [],
      settings: {
        version: 1,
        companyId: "company-1",
        source: "stored",
        warnings: [],
        definitions: [],
      },
    });

    const response = await companyNumberingPatch(
      new Request("http://localhost/api/v1/platform/company-numbering", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "SAVE",
          settings: { version: 1, definitions: [] },
        }),
      }),
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.saveCompanyCodeSettings).toHaveBeenCalledWith(ctx, {
      action: "SAVE",
      settings: { version: 1, definitions: [] },
    });
    expect(mocks.updateCompanyNumberingMasterConfig).not.toHaveBeenCalled();
  });

  it("dispatches RESET payloads to the structured service path", async () => {
    mocks.saveCompanyCodeSettings.mockResolvedValue({
      companyId: "company-1",
      formats: [],
      settings: {
        version: 1,
        companyId: "company-1",
        source: "stored",
        warnings: [],
        definitions: [],
      },
    });

    const response = await companyNumberingPatch(
      new Request("http://localhost/api/v1/platform/company-numbering", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "RESET" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.saveCompanyCodeSettings).toHaveBeenCalledWith(ctx, {
      action: "RESET",
    });
    expect(mocks.updateCompanyNumberingMasterConfig).not.toHaveBeenCalled();
  });

  it("keeps legacy flat updates on the compatibility update path", async () => {
    mocks.updateCompanyNumberingMasterConfig.mockResolvedValue({
      companyId: "company-1",
      formats: [],
      settings: {
        version: 1,
        companyId: "company-1",
        source: "stored",
        warnings: [],
        definitions: [],
      },
    });

    const response = await companyNumberingPatch(
      new Request("http://localhost/api/v1/platform/company-numbering", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          formats: [
            {
              key: "INVOICE",
              pattern: "INV-{YYYY}-{COMP}-{####}",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateCompanyNumberingMasterConfig).toHaveBeenCalledWith(ctx, {
      formats: [
        {
          key: "INVOICE",
          pattern: "INV-{YYYY}-{COMP}-{####}",
        },
      ],
    });
    expect(mocks.saveCompanyCodeSettings).not.toHaveBeenCalled();
  });

  it("forwards structured preview requests to the preview service", async () => {
    mocks.previewCompanyNumberingPattern.mockResolvedValue({
      key: "INVOICE",
      variantId: "standard",
      preview: "YAO.1071.FW.01.26.INV-015",
      issues: [],
    });

    const response = await companyNumberingPreviewPost(
      new Request("http://localhost/api/v1/platform/company-numbering/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "INVOICE",
          definition: { key: "INVOICE", variants: [] },
          variantId: "standard",
          sample: { clientShortCode: "FW" },
        }),
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      data: { preview: string };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.preview).toBe("YAO.1071.FW.01.26.INV-015");
    expect(mocks.previewCompanyNumberingPattern).toHaveBeenCalledWith(ctx, {
      key: "INVOICE",
      definition: { key: "INVOICE", variants: [] },
      variantId: "standard",
      sample: { clientShortCode: "FW" },
    });
  });
});
