import { z } from "zod";

export const opsInboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().trim().max(40).optional(),
  priority: z.string().trim().max(40).optional(),
});

export const opsRecommendationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  role: z.string().trim().max(80).optional(),
  status: z.string().trim().max(40).optional(),
});

export const executeWorkflowActionSchema = z.object({
  contextType: z.string().trim().min(1).max(120).default("ops"),
  contextRef: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  expectedState: z.string().trim().max(80).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const copilotResolveSchema = z.object({
  contextType: z.string().trim().min(1).max(120),
  contextRef: z.string().trim().min(1).max(120),
  problemSummary: z.string().trim().min(1).max(2000),
  constraints: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  requestedActionId: z.string().trim().max(120).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const aiFeedbackSchema = z
  .object({
    recommendationId: z.string().trim().max(120).optional(),
    draftId: z.string().trim().max(120).optional(),
    feedbackType: z.enum(["ACCEPT", "EDIT", "REJECT"]),
    reason: z.string().trim().max(500).optional(),
    signal: z.record(z.string(), z.any()).optional(),
  })
  .refine((value) => Boolean(value.recommendationId || value.draftId), {
    message: "Either recommendationId or draftId is required",
    path: ["recommendationId"],
  });

export const analyticsOpsQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(365).default(30),
});
