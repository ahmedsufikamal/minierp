import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyCampaignAction, createCampaign } from "@/modules/crm/application/campaigns.service";
import { applyLeadAction, createLead } from "@/modules/crm/application/leads.service";
import { applyOpportunityAction, createOpportunity } from "@/modules/crm/application/opportunities.service";
import { getCrmTimeline } from "@/modules/crm/application/timeline.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("crm wave5 integration", () => {
  const marker = `crm-wave5-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  let customerId = "";

  const ctx: PlatformRequestContext = {
    requestId: `${marker}-request`,
    tenantId,
    companyId,
    userId: `${marker}-user`,
    role: "OWNER",
    platformRole: "SUPER_ADMIN",
    permissions: [],
  };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    const customer = await prisma.customer.create({
      data: {
        companyId,
        name: `${marker}-customer`,
      },
      select: { id: true },
    });

    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { companyId } });

    await prisma.activity.deleteMany({ where: { companyId } });
    await prisma.opportunityStageHistory.deleteMany({ where: { companyId } });
    await prisma.opportunity.deleteMany({ where: { companyId } });
    await prisma.lead.deleteMany({ where: { companyId } });
    await prisma.campaign.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
  });

  it("runs CRM lead/campaign/opportunity workflow with timeline aggregation", async () => {
    const campaign = await createCampaign(ctx, {
      name: `${marker}-campaign`,
      budgetMinor: 50000,
      currency: "BDT",
    });

    const activeCampaign = await applyCampaignAction(ctx, campaign.id, { action: "ACTIVATE" });
    expect(activeCampaign.status).toBe("ACTIVE");

    const lead = await createLead(ctx, {
      campaignId: campaign.id,
      firstName: "Nadia",
      lastName: "Rahman",
      email: `${marker}@example.com`,
      source: "Website",
      notes: "Initial inbound lead",
    });

    const qualifiedLead = await applyLeadAction(ctx, lead.id, { action: "QUALIFY" });
    expect(qualifiedLead.status).toBe("QUALIFIED");

    const convertedLead = await applyLeadAction(ctx, lead.id, {
      action: "CONVERT",
      customerId,
    });
    expect(convertedLead.status).toBe("CONVERTED");

    const opportunity = await createOpportunity(ctx, {
      title: `${marker}-deal`,
      customerId,
      leadId: lead.id,
      campaignId: campaign.id,
      valueCents: 125000,
      description: "Potential annual contract",
    });

    const qualifiedOpportunity = await applyOpportunityAction(ctx, opportunity.id, { action: "QUALIFY" });
    expect(qualifiedOpportunity.stage).toBe("QUALIFICATION");

    const proposedOpportunity = await applyOpportunityAction(ctx, opportunity.id, { action: "PROPOSE" });
    expect(proposedOpportunity.stage).toBe("PROPOSAL");

    const negotiatingOpportunity = await applyOpportunityAction(ctx, opportunity.id, { action: "NEGOTIATE" });
    expect(negotiatingOpportunity.stage).toBe("NEGOTIATION");

    const wonOpportunity = await applyOpportunityAction(ctx, opportunity.id, { action: "WIN" });
    expect(wonOpportunity.stage).toBe("WON");
    expect(wonOpportunity.probabilityPct).toBe(100);

    await prisma.activity.create({
      data: {
        tenantId,
        companyId,
        customerId,
        campaignId: campaign.id,
        leadId: lead.id,
        opportunityId: opportunity.id,
        type: "CALL",
        subject: "Discovery call completed",
        description: "Stakeholders aligned for closing.",
      },
    });

    const timeline = await getCrmTimeline(ctx, {
      customerId,
      page: 1,
      limit: 100,
    });

    const types = new Set(timeline.rows.map((row) => row.type));
    expect(types.has("ACTIVITY")).toBe(true);
    expect(types.has("OPPORTUNITY_STAGE")).toBe(true);
    expect(types.has("LEAD_STATUS")).toBe(true);

    const persistedOpportunity = await prisma.opportunity.findUnique({
      where: { id: opportunity.id },
      include: {
        stageHistories: {
          orderBy: [{ changedAt: "asc" }],
        },
      },
    });

    expect(persistedOpportunity?.stage).toBe("WON");
    expect(persistedOpportunity?.stageHistories).toHaveLength(5);
  });
});
