import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    metaWorkflowDef: {
      findFirst: mocks.findFirst,
    },
  },
}));

import { enforcePublishedWorkflowTransition } from "@/modules/platform/application/meta-model.service";

const ctx: PlatformRequestContext = {
  requestId: "req-1",
  tenantId: "tenant-1",
  companyId: "company-1",
  userId: "user-1",
  role: "ADMIN",
  platformRole: "NONE",
  permissions: ["master.write"],
};

afterEach(() => {
  mocks.findFirst.mockReset();
});

describe("workflow transition enforcement", () => {
  it("allows transition when published workflow has matching edge and permission", async () => {
    mocks.findFirst.mockResolvedValue({
      transitions: [
        {
          actionKey: "STATUS_CHANGE",
          fromState: "DRAFT",
          toState: "ACTIVE",
          requiredPermissions: ["master.write"],
        },
      ],
    });

    await expect(
      enforcePublishedWorkflowTransition(ctx, {
        modelName: "Party",
        fromState: "DRAFT",
        toState: "ACTIVE",
        actionKey: "STATUS_CHANGE",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects unknown transition", async () => {
    mocks.findFirst.mockResolvedValue({
      transitions: [],
    });

    await expect(
      enforcePublishedWorkflowTransition(ctx, {
        modelName: "Party",
        fromState: "ACTIVE",
        toState: "ARCHIVED",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
