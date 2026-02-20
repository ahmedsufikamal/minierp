import { CampaignStatus, LeadStatus, OpportunityStage } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const campaignListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
});

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  startsOn: z.coerce.date().optional().nullable(),
  endsOn: z.coerce.date().optional().nullable(),
  budgetMinor: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().trim().min(1).max(10).default("BDT"),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const campaignActionSchema = z.object({
  action: z.enum(["ACTIVATE", "COMPLETE", "CANCEL"]),
});

export const leadListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  campaignId: z.string().trim().optional(),
});

export const leadCreateSchema = z.object({
  campaignId: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const leadActionSchema = z.object({
  action: z.enum(["QUALIFY", "LOSE", "CONVERT"]),
  customerId: z.string().trim().optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const opportunityListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  stage: z.nativeEnum(OpportunityStage).optional(),
  customerId: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  campaignId: z.string().trim().optional(),
});

export const opportunityCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  valueCents: z.number().int().nonnegative().default(0),
  customerId: z.string().trim().min(1),
  leadId: z.string().trim().optional().nullable(),
  campaignId: z.string().trim().optional().nullable(),
  probabilityPct: z.number().int().min(0).max(100).optional().nullable(),
  closeDate: z.coerce.date().optional().nullable(),
  description: z.string().trim().max(3000).optional().nullable(),
});

export const opportunityActionSchema = z.object({
  action: z.enum(["QUALIFY", "PROPOSE", "NEGOTIATE", "WIN", "LOSE", "REOPEN"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const timelineQuerySchema = paginationSchema.extend({
  customerId: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  opportunityId: z.string().trim().optional(),
  campaignId: z.string().trim().optional(),
});
