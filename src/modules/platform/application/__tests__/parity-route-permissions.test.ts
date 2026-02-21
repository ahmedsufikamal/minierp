import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformRequestContext: vi.fn(),
  getPayablesAging: vi.fn(),
  getReceivablesAging: vi.fn(),
  listProjectBillingEntries: vi.fn(),
  createProjectBillingEntry: vi.fn(),
  listQualityGoals: vi.fn(),
  createQualityGoal: vi.fn(),
  listKnowledgeArticles: vi.fn(),
  createKnowledgeArticle: vi.fn(),
  applyKnowledgeArticleAction: vi.fn(),
  listFormLayouts: vi.fn(),
  createFormLayout: vi.fn(),
  listPropertyOverrideRules: vi.fn(),
  createPropertyOverrideRule: vi.fn(),
  applyAutomationRuleAction: vi.fn(),
  listAutomationRuns: vi.fn(),
  createAutomationRun: vi.fn(),
  resolveCustomizationRuntime: vi.fn(),
  listCompanyNumberingMasterConfig: vi.fn(),
  updateCompanyNumberingMasterConfig: vi.fn(),
  previewCompanyNumberingPattern: vi.fn(),
}));

vi.mock("@/modules/platform/interface/context", () => ({
  getPlatformRequestContext: mocks.getPlatformRequestContext,
}));

vi.mock("@/modules/buying/application/payables.service", () => ({
  getPayablesAging: mocks.getPayablesAging,
}));

vi.mock("@/modules/selling/application/receivables.service", () => ({
  getReceivablesAging: mocks.getReceivablesAging,
}));

vi.mock("@/modules/projects/application/billing.service", () => ({
  listProjectBillingEntries: mocks.listProjectBillingEntries,
  createProjectBillingEntry: mocks.createProjectBillingEntry,
}));

vi.mock("@/modules/quality/application/goals.service", () => ({
  listQualityGoals: mocks.listQualityGoals,
  createQualityGoal: mocks.createQualityGoal,
}));

vi.mock("@/modules/support/application/knowledge-base.service", () => ({
  listKnowledgeArticles: mocks.listKnowledgeArticles,
  createKnowledgeArticle: mocks.createKnowledgeArticle,
  applyKnowledgeArticleAction: mocks.applyKnowledgeArticleAction,
}));

vi.mock("@/modules/platform/application/customization.service", () => ({
  listFormLayouts: mocks.listFormLayouts,
  createFormLayout: mocks.createFormLayout,
  listPropertyOverrideRules: mocks.listPropertyOverrideRules,
  createPropertyOverrideRule: mocks.createPropertyOverrideRule,
  applyAutomationRuleAction: mocks.applyAutomationRuleAction,
  resolveCustomizationRuntime: mocks.resolveCustomizationRuntime,
}));

vi.mock("@/modules/platform/application/automation-runtime.service", () => ({
  listAutomationRuns: mocks.listAutomationRuns,
  createAutomationRun: mocks.createAutomationRun,
}));

vi.mock("@/modules/platform/application/company-numbering.service", () => ({
  listCompanyNumberingMasterConfig: mocks.listCompanyNumberingMasterConfig,
  updateCompanyNumberingMasterConfig: mocks.updateCompanyNumberingMasterConfig,
  previewCompanyNumberingPattern: mocks.previewCompanyNumberingPattern,
}));

import { GET as buyingPayablesAgingGet } from "@/app/api/v1/buying/payables-aging/route";
import { GET as sellingReceivablesAgingGet } from "@/app/api/v1/selling/receivables-aging/route";
import { GET as projectsBillingGet, POST as projectsBillingPost } from "@/app/api/v1/projects/billing/route";
import { GET as qualityGoalsGet } from "@/app/api/v1/quality/goals/route";
import { GET as supportKbGet, POST as supportKbPost } from "@/app/api/v1/support/knowledge-base/route";
import { PATCH as supportKbActionPatch } from "@/app/api/v1/support/knowledge-base/[articleId]/actions/route";
import { GET as formLayoutsGet } from "@/app/api/v1/platform/customization/form-layouts/route";
import { POST as fieldRulesPost } from "@/app/api/v1/platform/customization/field-rules/route";
import { PATCH as automationRuleActionPatch } from "@/app/api/v1/platform/customization/automation-rules/[ruleId]/actions/route";
import { POST as automationRunsPost } from "@/app/api/v1/platform/customization/automation-runs/route";
import { GET as runtimeGet } from "@/app/api/v1/platform/customization/runtime/route";
import { GET as companyNumberingGet, PATCH as companyNumberingPatch } from "@/app/api/v1/platform/company-numbering/route";
import { POST as companyNumberingPreviewPost } from "@/app/api/v1/platform/company-numbering/preview/route";

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
  Object.values(mocks).forEach((mockFn) => {
    mockFn.mockReset();
  });
});

async function expectForbidden(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  const body = (await response.json()) as {
    ok: boolean;
    error?: { code?: string };
  };

  expect(response.status).toBe(403);
  expect(body.ok).toBe(false);
  expect(body.error?.code).toBe("FORBIDDEN");
}

describe("new parity endpoint permission checks", () => {
  it("denies AP/AR/reporting baseline endpoints without scoped permissions", async () => {
    await expectForbidden(
      buyingPayablesAgingGet(new Request("http://localhost/api/v1/buying/payables-aging")),
    );
    await expectForbidden(
      sellingReceivablesAgingGet(new Request("http://localhost/api/v1/selling/receivables-aging")),
    );
    await expectForbidden(projectsBillingGet(new Request("http://localhost/api/v1/projects/billing")));
    await expectForbidden(qualityGoalsGet(new Request("http://localhost/api/v1/quality/goals")));

    expect(mocks.getPayablesAging).not.toHaveBeenCalled();
    expect(mocks.getReceivablesAging).not.toHaveBeenCalled();
    expect(mocks.listProjectBillingEntries).not.toHaveBeenCalled();
    expect(mocks.listQualityGoals).not.toHaveBeenCalled();
  });

  it("denies support knowledge base endpoints without permission", async () => {
    await expectForbidden(supportKbGet(new Request("http://localhost/api/v1/support/knowledge-base")));

    await expectForbidden(
      supportKbPost(
        new Request("http://localhost/api/v1/support/knowledge-base", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug: "kb-1",
            title: "KB",
            content: "content",
          }),
        }),
      ),
    );

    await expectForbidden(
      supportKbActionPatch(
        new Request("http://localhost/api/v1/support/knowledge-base/article-1/actions", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "PUBLISH" }),
        }),
        { params: Promise.resolve({ articleId: "article-1" }) },
      ),
    );

    expect(mocks.listKnowledgeArticles).not.toHaveBeenCalled();
    expect(mocks.createKnowledgeArticle).not.toHaveBeenCalled();
    expect(mocks.applyKnowledgeArticleAction).not.toHaveBeenCalled();
  });

  it("denies platform customization runtime endpoints without permission", async () => {
    await expectForbidden(
      formLayoutsGet(new Request("http://localhost/api/v1/platform/customization/form-layouts")),
    );

    await expectForbidden(
      fieldRulesPost(
        new Request("http://localhost/api/v1/platform/customization/field-rules", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entityType: "Project",
            target: "FIELD",
            key: "priority",
            config: { hidden: false },
          }),
        }),
      ),
    );

    await expectForbidden(
      automationRuleActionPatch(
        new Request("http://localhost/api/v1/platform/customization/automation-rules/rule-1/actions", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "RUN", trigger: "ON_SUBMIT", entityId: "entity-1" }),
        }),
        { params: Promise.resolve({ ruleId: "rule-1" }) },
      ),
    );

    await expectForbidden(
      automationRunsPost(
        new Request("http://localhost/api/v1/platform/customization/automation-runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            automationRuleId: "rule-1",
            entityType: "Project",
            trigger: "ON_SUBMIT",
          }),
        }),
      ),
    );

    await expectForbidden(
      runtimeGet(
        new Request("http://localhost/api/v1/platform/customization/runtime?entityType=Project"),
      ),
    );

    expect(mocks.listFormLayouts).not.toHaveBeenCalled();
    expect(mocks.createPropertyOverrideRule).not.toHaveBeenCalled();
    expect(mocks.applyAutomationRuleAction).not.toHaveBeenCalled();
    expect(mocks.createAutomationRun).not.toHaveBeenCalled();
    expect(mocks.resolveCustomizationRuntime).not.toHaveBeenCalled();
  });

  it("denies company numbering endpoints without permission", async () => {
    await expectForbidden(
      companyNumberingGet(new Request("http://localhost/api/v1/platform/company-numbering")),
    );

    await expectForbidden(
      companyNumberingPatch(
        new Request("http://localhost/api/v1/platform/company-numbering", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            formats: [{ key: "SKU", pattern: "SKU-{COMP}-{####}" }],
          }),
        }),
      ),
    );

    await expectForbidden(
      companyNumberingPreviewPost(
        new Request("http://localhost/api/v1/platform/company-numbering/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: "INVOICE",
          }),
        }),
      ),
    );

    expect(mocks.listCompanyNumberingMasterConfig).not.toHaveBeenCalled();
    expect(mocks.updateCompanyNumberingMasterConfig).not.toHaveBeenCalled();
    expect(mocks.previewCompanyNumberingPattern).not.toHaveBeenCalled();
  });

  it("denies project billing writes without permission", async () => {
    await expectForbidden(
      projectsBillingPost(
        new Request("http://localhost/api/v1/projects/billing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: "project-1",
            billAmountCents: 1200,
            currency: "USD",
          }),
        }),
      ),
    );

    expect(mocks.createProjectBillingEntry).not.toHaveBeenCalled();
  });
});
