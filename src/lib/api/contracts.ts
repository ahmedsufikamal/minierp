export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | (string & {});

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
}

export interface ApiScope {
  tenantId?: string;
  companyId?: string;
  requestId?: string;
}

export interface ApiSuccessEnvelope<TData> {
  ok: true;
  data: TData;
  pagination?: ApiPagination;
  scope?: ApiScope;
}

export interface ApiErrorEnvelope {
  ok: false;
  error: ApiErrorPayload;
}

export type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;

export type ApiListResult<TRow> = {
  rows: TRow[];
  page: number;
  limit: number;
  total: number;
};

export type StockWorkspaceMetricsDto = {
  total_stock_value: { amount: number; currency: string };
  total_warehouses: number;
  total_active_items: number;
  last_synced_at: string;
};

export type StockWarehouseValueSeriesDto = {
  last_synced_at: string;
  series: Array<{
    warehouse_id: string;
    warehouse_name: string;
    stock_value: { amount: number; currency: string };
  }>;
};

export type StockQuickAccessDto = {
  items_available: number;
  delivery_note_to_bill: number;
  material_request_pending: number;
  purchase_receipt_to_bill: number;
};

export type StockItemsListQueryDto = {
  page?: number;
  page_size?: number;
  id?: string;
  query?: string;
  item_group?: string;
  has_variants?: boolean;
  variant_of?: string;
  assigned_to?: string;
  created_by?: string;
  tags?: string;
  sort?: string;
};

export type StockItemsListRowDto = {
  id: string;
  item_name: string;
  status: "ENABLED" | "DISABLED" | "TEMPLATE" | string;
  item_group: string | null;
  item_code: string;
  updated_at: string;
  has_variants: boolean;
  variant_of: string | null;
  assigned_to: string | null;
  created_by: string | null;
  tags: string[];
};

export type StockItemsListResponseDto = {
  total: number;
  page: number;
  page_size: number;
  items: StockItemsListRowDto[];
};

export type StockSettingsCommentDto = {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
};

export type StockSettingsActivityDto = {
  id: string;
  type: string;
  message: string;
  actor_user_id: string | null;
  created_at: string;
  metadata?: unknown;
};

export type OpsInboxItem = {
  id: string;
  itemType: "TASK" | "EXCEPTION";
  title: string;
  summary: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  dueAt?: string | null;
  sourceType: string;
  sourceId?: string | null;
  assigneeUserId?: string | null;
  metadata?: unknown;
  createdAt: string;
};

export type WorkflowActionCommand = {
  actionId: string;
  commandKey: string;
  idempotencyKey: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REPLAYED";
  reversibleState: {
    revertActionId: string;
    beforeState?: string | null;
    afterState?: string | null;
    rollbackReady: boolean;
  };
  executedAt: string;
  result: Record<string, unknown>;
};

export type ActionRecommendation = {
  id: string;
  actionId: string;
  actionLabel: string;
  role: string;
  score: number;
  confidence: number;
  rationale: unknown;
  status: "ACTIVE" | "APPLIED" | "DISMISSED" | "EXPIRED";
  contextType: string;
  contextRef?: string | null;
  createdAt: string;
};

export type CopilotResolutionDraft = {
  id: string;
  contextType: string;
  contextRef: string;
  draftText: string;
  confidence: number;
  sourceSignals: unknown;
  expectedImpact: unknown;
  rollbackPlan: unknown;
  status: "DRAFT" | "APPLIED" | "DISCARDED";
  createdAt: string;
  updatedAt: string;
};

export type AiFeedbackEvent = {
  id: string;
  recommendationId?: string | null;
  draftId?: string | null;
  feedbackType: "ACCEPT" | "EDIT" | "REJECT";
  reason?: string | null;
  signal?: unknown;
  requestId?: string | null;
  createdAt: string;
};

export type OperationalKpiSnapshot = {
  windowDays: number;
  taskOpenCount: number;
  exceptionOpenCount: number;
  actionExecutionCount: number;
  actionSuccessRatePct: number;
  aiAdoptionPct: number;
  updatedAt: string;
};
