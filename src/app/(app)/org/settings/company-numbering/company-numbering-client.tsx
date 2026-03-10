"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { NumberSeriesResetPolicy } from "@prisma/client";
import {
  AlertTriangle,
  ArrowDownToLine,
  Copy,
  FileJson,
  GripVertical,
  Info,
  Layers3,
  PencilRuler,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/cn";
import {
  buildSettingsEnvelopeFromDefinitions,
  cloneCompanyCodeSettingsEnvelope,
  compareFormatConfigChanges,
  createDefaultTokenDefinition,
  formatCodePreview,
  getCompatibilityProjection,
  getDefaultSampleCodeInputs,
  humanizeTokenKind,
  loadYgenDefaults,
  parseSettingsEnvelope,
  sequenceScopes,
  tokenKinds,
  validateCodeFormatConfig,
  type ChangeSummary,
  type CodeFormatDefinition,
  type CodeFormatVariant,
  type CompanyCodeDefinitionKey,
  type CompanyCodeFormatSettingsEnvelope,
  type PreviewInput,
  type SequenceScope,
  type TokenDefinition,
  type TokenKind,
  type ValidationIssue,
} from "@/modules/platform/domain/company-code-format-settings";

type NumberingRow = {
  key: string;
  name: string;
  pattern: string;
  resetPolicy: NumberSeriesResetPolicy;
  startAt: number;
  padding: number;
  isActive: boolean;
};

type ApiError = {
  ok: false;
  error?: { code?: string; message?: string };
};

type ApiResponse = {
  ok: true;
  data: {
    companyId: string;
    formats: NumberingRow[];
    settings: CompanyCodeFormatSettingsEnvelope;
  };
};

const textareaClassName =
  "min-h-[96px] w-full rounded-xl border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-1))] px-3 py-2 text-sm shadow-sm outline-none transition focus-visible:border-[hsl(var(--ring)/0.55)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring)/0.2)]";
const selectClassName =
  "h-10 w-full rounded-xl border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-1))] px-3 text-sm shadow-sm outline-none transition focus-visible:border-[hsl(var(--ring)/0.55)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring)/0.2)]";
const panelClassName =
  "rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[linear-gradient(180deg,hsl(var(--surface-1))/0.98_0%,hsl(var(--surface-2))/0.86_100%)] shadow-sm";

const tokenKindOptions: Array<{ value: TokenKind; label: string }> = tokenKinds.map((kind) => ({
  value: kind,
  label: humanizeTokenKind(kind).replace(/\b\w/g, (match) => match.toUpperCase()),
}));

const resetPolicyOptions: Array<{ value: NumberSeriesResetPolicy; label: string }> = [
  { value: NumberSeriesResetPolicy.NEVER, label: "Never" },
  { value: NumberSeriesResetPolicy.CALENDAR_YEAR, label: "Calendar year" },
  { value: NumberSeriesResetPolicy.FISCAL_YEAR, label: "Fiscal year" },
  { value: NumberSeriesResetPolicy.MONTHLY, label: "Monthly" },
];

function cloneEnvelope(envelope: CompanyCodeFormatSettingsEnvelope): CompanyCodeFormatSettingsEnvelope {
  return cloneCompanyCodeSettingsEnvelope(envelope);
}

function buildBlueprint(variant: CodeFormatVariant): string {
  return variant.tokens
    .map((token) => {
      switch (token.kind) {
        case "STATIC":
          return token.staticValue ?? "TXT";
        case "SEPARATOR":
          return token.separator ?? ".";
        case "OFFER_NUMBER":
          return "{offer}";
        case "CLIENT_SHORT_CODE":
          return "{client}";
        case "QUOTE_MONTH":
          return "{quoteMonth}";
        case "QUOTE_YEAR":
          return token.yearFormat === "YYYY" ? "{quoteYear4}" : "{quoteYear}";
        case "DELIVERY_MONTH":
          return "{deliveryMonth}";
        case "DELIVERY_YEAR":
          return token.yearFormat === "YYYY" ? "{deliveryYear4}" : "{deliveryYear}";
        case "INVOICE_MONTH":
          return "{invoiceMonth}";
        case "INVOICE_YEAR":
          return token.yearFormat === "YYYY" ? "{invoiceYear4}" : "{invoiceYear}";
        case "SALESPERSON_INITIALS":
          return "{sales}";
        case "REVISION_NUMBER":
          return "R{revision}";
        case "SERIAL_NUMBER":
          return "{serial}";
      }
    })
    .join("");
}

function groupedIssues(issues: ValidationIssue[]): Record<CompanyCodeDefinitionKey, ValidationIssue[]> {
  return issues.reduce(
    (acc, issue) => {
      const bucket = acc[issue.key] ?? [];
      bucket.push(issue);
      acc[issue.key] = bucket;
      return acc;
    },
    {} as Record<CompanyCodeDefinitionKey, ValidationIssue[]>,
  );
}

function definitionKeyBadge(key: string): string {
  return key.replaceAll("_", " ");
}

function toEnvelopeFromImport(input: unknown, companyId: string): CompanyCodeFormatSettingsEnvelope | null {
  const parsedEnvelope = parseSettingsEnvelope(input);
  if (parsedEnvelope) {
    return {
      ...parsedEnvelope,
      companyId,
      source: "stored",
      warnings: [],
    };
  }

  const maybeDefinitions = input as { definitions?: CodeFormatDefinition[] } | null;
  if (maybeDefinitions?.definitions) {
    return buildSettingsEnvelopeFromDefinitions({
      companyId,
      definitions: maybeDefinitions.definitions,
      source: "stored",
      warnings: [],
    });
  }

  return null;
}

function copyToClipboard(value: string, successMessage: string) {
  void navigator.clipboard
    .writeText(value)
    .then(() => toast.success(successMessage))
    .catch(() => toast.error("Clipboard access failed."));
}

function SortableTokenRow({
  definitionKey,
  variant,
  token,
  tokenIndex,
  disabled,
  onTokenChange,
  onTokenRemove,
}: {
  definitionKey: CompanyCodeDefinitionKey;
  variant: CodeFormatVariant;
  token: TokenDefinition;
  tokenIndex: number;
  disabled: boolean;
  onTokenChange: (tokenId: string, next: TokenDefinition) => void;
  onTokenRemove: (tokenId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: token.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const update = (patch: Partial<TokenDefinition>) => onTokenChange(token.id, { ...token, ...patch });

  const replaceKind = (nextKind: TokenKind) => {
    const next = createDefaultTokenDefinition(nextKind, {
      key: definitionKey,
      variantId: variant.id,
      index: tokenIndex + 1,
    });
    onTokenChange(token.id, {
      ...next,
      id: token.id,
    });
  };

  const sequence = token.sequenceRule;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "space-y-3 rounded-2xl border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-1))/0.88] p-4 shadow-sm",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-2))] text-muted-foreground"
          aria-label="Reorder token"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-[200px] flex-1">
          <Label className="mb-1 block text-xs text-muted-foreground">Token kind</Label>
          <select
            className={selectClassName}
            value={token.kind}
            onChange={(event) => replaceKind(event.target.value as TokenKind)}
            disabled={disabled}
          >
            {tokenKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <Label className="mb-1 block text-xs text-muted-foreground">Label</Label>
          <Input value={token.label} disabled={disabled} onChange={(event) => update({ label: event.target.value })} />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-2))/0.8] px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={token.required}
            disabled={disabled}
            onChange={(event) => update({ required: event.target.checked })}
          />
          Required
        </label>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onTokenRemove(token.id)}>
          Remove
        </Button>
      </div>

      {(token.kind === "STATIC" || token.kind === "SEPARATOR") && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              {token.kind === "STATIC" ? "Static value" : "Separator"}
            </Label>
            <Input
              value={token.kind === "STATIC" ? token.staticValue ?? "" : token.separator ?? ""}
              disabled={disabled}
              onChange={(event) =>
                update(token.kind === "STATIC" ? { staticValue: event.target.value } : { separator: event.target.value })
              }
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Notes</Label>
            <Input value={token.notes ?? ""} disabled={disabled} onChange={(event) => update({ notes: event.target.value })} />
          </div>
        </div>
      )}

      {(token.kind === "QUOTE_YEAR" || token.kind === "DELIVERY_YEAR" || token.kind === "INVOICE_YEAR") && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Year format</Label>
            <select
              className={selectClassName}
              value={token.yearFormat ?? "YY"}
              disabled={disabled}
              onChange={(event) => update({ yearFormat: event.target.value as "YY" | "YYYY" })}
            >
              <option value="YY">Two-digit year</option>
              <option value="YYYY">Four-digit year</option>
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Notes</Label>
            <Input value={token.notes ?? ""} disabled={disabled} onChange={(event) => update({ notes: event.target.value })} />
          </div>
        </div>
      )}

      {sequence && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Namespace</Label>
            <Input
              value={sequence.namespace}
              disabled={disabled}
              onChange={(event) =>
                update({
                  sequenceRule: {
                    ...sequence,
                    namespace: event.target.value,
                  },
                })
              }
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Start at</Label>
            <Input
              type="number"
              value={sequence.startAt}
              disabled={disabled}
              onChange={(event) =>
                update({
                  sequenceRule: {
                    ...sequence,
                    startAt: Number(event.target.value || 0),
                  },
                })
              }
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Zero padding</Label>
            <Input
              type="number"
              value={sequence.zeroPadding}
              disabled={disabled}
              onChange={(event) =>
                update({
                  sequenceRule: {
                    ...sequence,
                    zeroPadding: Number(event.target.value || 1),
                  },
                })
              }
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Reset policy</Label>
            <select
              className={selectClassName}
              value={sequence.resetPolicy}
              disabled={disabled}
              onChange={(event) =>
                update({
                  sequenceRule: {
                    ...sequence,
                    resetPolicy: event.target.value as NumberSeriesResetPolicy,
                  },
                })
              }
            >
              {resetPolicyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Scope</Label>
            <select
              className={selectClassName}
              value={sequence.scope}
              disabled={disabled}
              onChange={(event) =>
                update({
                  sequenceRule: {
                    ...sequence,
                    scope: event.target.value as SequenceScope,
                  },
                })
              }
            >
              {sequenceScopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenBuilder({
  definitionKey,
  variant,
  disabled,
  onVariantChange,
}: {
  definitionKey: CompanyCodeDefinitionKey;
  variant: CodeFormatVariant;
  disabled: boolean;
  onVariantChange: (next: CodeFormatVariant) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [pendingKind, setPendingKind] = useState<TokenKind>("STATIC");

  const reorderTokens = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = variant.tokens.findIndex((token) => token.id === active.id);
    const newIndex = variant.tokens.findIndex((token) => token.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onVariantChange({
      ...variant,
      tokens: arrayMove(variant.tokens, oldIndex, newIndex),
    });
  };

  const setToken = (tokenId: string, nextToken: TokenDefinition) => {
    onVariantChange({
      ...variant,
      tokens: variant.tokens.map((token) => (token.id === tokenId ? nextToken : token)),
    });
  };

  const removeToken = (tokenId: string) => {
    onVariantChange({
      ...variant,
      tokens: variant.tokens.filter((token) => token.id !== tokenId),
      primarySequenceTokenId:
        variant.primarySequenceTokenId === tokenId ? null : variant.primarySequenceTokenId,
    });
  };

  const addToken = () => {
    onVariantChange({
      ...variant,
      tokens: [
        ...variant.tokens,
        createDefaultTokenDefinition(pendingKind, {
          key: definitionKey,
          variantId: variant.id,
          index: variant.tokens.length + 1,
        }),
      ],
    });
  };

  const numericTokens = variant.tokens.filter((token) => Boolean(token.sequenceRule));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-2))/0.62] p-4">
        <div className="min-w-[220px] flex-1">
          <Label className="mb-1 block text-xs text-muted-foreground">Add token</Label>
          <select className={selectClassName} value={pendingKind} onChange={(event) => setPendingKind(event.target.value as TokenKind)} disabled={disabled}>
            {tokenKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[220px] flex-1">
          <Label className="mb-1 block text-xs text-muted-foreground">Primary compatibility sequence</Label>
          <select
            className={selectClassName}
            value={variant.primarySequenceTokenId ?? ""}
            disabled={disabled}
            onChange={(event) => onVariantChange({ ...variant, primarySequenceTokenId: event.target.value || null })}
          >
            <option value="">Select sequence token</option>
            {numericTokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={addToken} disabled={disabled}>
          Add token
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderTokens}>
        <SortableContext items={variant.tokens.map((token) => token.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {variant.tokens.map((token, index) => (
              <SortableTokenRow
                key={token.id}
                definitionKey={definitionKey}
                variant={variant}
                token={token}
                tokenIndex={index}
                disabled={disabled}
                onTokenChange={setToken}
                onTokenRemove={removeToken}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
          {errors.length} blocking
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {warnings.length} warnings
        </span>
      </div>
      {issues.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Validation passed for this section.
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <div
              key={`${issue.key}-${issue.variantId ?? "definition"}-${issue.field ?? issue.message}`}
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm",
                issue.severity === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-800",
              )}
            >
              <p className="font-medium">{issue.variantId ? `Variant: ${issue.variantId}` : "Definition"}</p>
              <p>{issue.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CodeFormatCard({
  definition,
  allDefinitions,
  issues,
  sample,
  previewMode,
  disabled,
  onDefinitionChange,
  onResetDefinition,
  onCloneFromOtherType,
}: {
  definition: CodeFormatDefinition;
  allDefinitions: CodeFormatDefinition[];
  issues: ValidationIssue[];
  sample: PreviewInput;
  previewMode: boolean;
  disabled: boolean;
  onDefinitionChange: (next: CodeFormatDefinition) => void;
  onResetDefinition: () => void;
  onCloneFromOtherType: (sourceKey: CompanyCodeDefinitionKey) => void;
}) {
  const [cloneSource, setCloneSource] = useState<CompanyCodeDefinitionKey | "">("");

  const activeVariant =
    definition.variants.find((variant) => variant.id === definition.activeVariantId) ?? definition.variants[0];
  const compatibility = getCompatibilityProjection(definition);

  const updateVariant = (nextVariant: CodeFormatVariant) => {
    onDefinitionChange({
      ...definition,
      variants: definition.variants.map((variant) => (variant.id === nextVariant.id ? nextVariant : variant)),
    });
  };

  const duplicateVariant = () => {
    if (!activeVariant) return;
    const cloned: CodeFormatVariant = {
      ...activeVariant,
      id: `${activeVariant.id}-copy-${Date.now()}`,
      label: `${activeVariant.label} Copy`,
    };
    onDefinitionChange({
      ...definition,
      activeVariantId: cloned.id,
      variants: [...definition.variants, cloned],
    });
  };

  return (
    <Card className="overflow-hidden border-[hsl(var(--border)/0.78)]">
      <CardHeader className="border-b border-[hsl(var(--border)/0.55)] bg-[linear-gradient(180deg,hsl(var(--surface-1))/0.96_0%,hsl(var(--surface-2))/0.72_100%)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{definition.displayName}</CardTitle>
              <span className="rounded-full border border-[hsl(var(--border)/0.75)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {definitionKeyBadge(definition.internalKey)}
              </span>
              <span className="rounded-full border border-[hsl(var(--border)/0.75)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                v{definition.version}
              </span>
            </div>
            <CardDescription>{definition.description}</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-1))/0.72] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={definition.enabled}
                disabled={disabled}
                onChange={(event) => onDefinitionChange({ ...definition, enabled: event.target.checked })}
              />
              Enabled
            </label>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={duplicateVariant}>
              Duplicate active variant
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onResetDefinition}>
              Reset section
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 pt-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${definition.key}-display-name`}>Display name</Label>
              <Input
                id={`${definition.key}-display-name`}
                value={definition.displayName}
                disabled={disabled}
                onChange={(event) => onDefinitionChange({ ...definition, displayName: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${definition.key}-internal-key`}>Internal key</Label>
              <Input id={`${definition.key}-internal-key`} value={definition.internalKey} disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${definition.key}-description`}>Description</Label>
              <textarea
                id={`${definition.key}-description`}
                className={textareaClassName}
                value={definition.description}
                disabled={disabled}
                onChange={(event) => onDefinitionChange({ ...definition, description: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${definition.key}-notes`}>Admin notes</Label>
              <textarea
                id={`${definition.key}-notes`}
                className={textareaClassName}
                value={definition.adminNotes ?? ""}
                disabled={disabled}
                onChange={(event) => onDefinitionChange({ ...definition, adminNotes: event.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2))/0.62] p-4">
            <div className="min-w-[220px] flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground">Clone active variant from another type</Label>
              <select className={selectClassName} value={cloneSource} onChange={(event) => setCloneSource(event.target.value as CompanyCodeDefinitionKey | "")} disabled={disabled}>
                <option value="">Choose source</option>
                {allDefinitions
                  .filter((entry) => entry.key !== definition.key)
                  .map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.displayName}
                    </option>
                  ))}
              </select>
            </div>
            <Button type="button" variant="outline" disabled={disabled || !cloneSource} onClick={() => cloneSource && onCloneFromOtherType(cloneSource)}>
              Clone variant
            </Button>
          </div>

          <Tabs
            value={activeVariant?.id ?? definition.activeVariantId}
            onValueChange={(value) => {
              onDefinitionChange({ ...definition, activeVariantId: value });
            }}
          >
            <TabsList className="w-full justify-start overflow-auto">
              {definition.variants.map((variant) => (
                <TabsTrigger key={variant.id} value={variant.id}>
                  {variant.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {definition.variants.map((variant) => {
              const variantPreview = formatCodePreview(definition, variant.id, sample);
              const variantIssues = issues.filter((issue) => issue.variantId === variant.id || !issue.variantId);
              return (
                <TabsContent key={variant.id} value={variant.id} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${definition.key}-${variant.id}-label`}>Variant label</Label>
                      <Input
                        id={`${definition.key}-${variant.id}-label`}
                        value={variant.label}
                        disabled={disabled}
                        onChange={(event) => updateVariant({ ...variant, label: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${definition.key}-${variant.id}-enabled`}>Variant state</Label>
                      <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-1))/0.72] px-3 text-sm">
                        <input
                          id={`${definition.key}-${variant.id}-enabled`}
                          type="checkbox"
                          checked={variant.enabled}
                          disabled={disabled}
                          onChange={(event) => updateVariant({ ...variant, enabled: event.target.checked })}
                        />
                        Enabled for preview and future routing
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${definition.key}-${variant.id}-description`}>Variant description</Label>
                      <textarea
                        id={`${definition.key}-${variant.id}-description`}
                        className={textareaClassName}
                        value={variant.description}
                        disabled={disabled}
                        onChange={(event) => updateVariant({ ...variant, description: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${definition.key}-${variant.id}-notes`}>Variant notes</Label>
                      <textarea
                        id={`${definition.key}-${variant.id}-notes`}
                        className={textareaClassName}
                        value={variant.notes ?? ""}
                        disabled={disabled}
                        onChange={(event) => updateVariant({ ...variant, notes: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2))/0.42] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                          Blueprint
                        </p>
                        <p className="mt-2 font-mono text-sm text-foreground">{buildBlueprint(variant)}</p>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => copyToClipboard(variantPreview, "Preview copied to clipboard.")}>
                        <Copy className="mr-1.5 h-4 w-4" />
                        Copy preview
                      </Button>
                    </div>
                  </div>

                  {!previewMode && (
                    <TokenBuilder
                      definitionKey={definition.key}
                      variant={variant}
                      disabled={disabled}
                      onVariantChange={updateVariant}
                    />
                  )}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className={cn(panelClassName, "p-5")}>
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Live preview
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{variant.description}</p>
                      <div className="mt-4 rounded-2xl border border-[hsl(var(--border)/0.8)] bg-background px-4 py-5">
                        <p className="break-all font-mono text-base font-semibold text-foreground">{variantPreview || "Preview unavailable"}</p>
                      </div>
                    </div>
                    <div className={cn(panelClassName, "p-5")}>
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <PencilRuler className="h-4 w-4 text-primary" />
                        Validation
                      </div>
                      <div className="mt-4">
                        <ValidationPanel issues={variantIssues} />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        <div className="space-y-4">
          <div className={cn(panelClassName, "p-5")}>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Layers3 className="h-4 w-4 text-primary" />
              Compatibility projection
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Phase 1 keeps live issuance on the current allocator. The values below are the safe compatibility fields saved back into NumberSeries.
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pattern</dt>
                <dd className="font-mono text-right">{compatibility.pattern}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reset</dt>
                <dd>{compatibility.resetPolicy}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Start at</dt>
                <dd>{compatibility.startAt}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Padding</dt>
                <dd>{compatibility.padding}</dd>
              </div>
            </dl>
          </div>

          <div className={cn(panelClassName, "p-5")}>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Info className="h-4 w-4 text-primary" />
              Metadata
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Effective date</dt>
                <dd>{definition.effectiveDate || "Phase 2 placeholder"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Updated by</dt>
                <dd>{definition.updatedBy || "Not saved yet"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Updated at</dt>
                <dd>{definition.updatedAt ? new Date(definition.updatedAt).toLocaleString() : "Not saved yet"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanyNumberingClient({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const importRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedEnvelope, setSavedEnvelope] = useState<CompanyCodeFormatSettingsEnvelope | null>(null);
  const [draftEnvelope, setDraftEnvelope] = useState<CompanyCodeFormatSettingsEnvelope | null>(null);
  const [sampleInput, setSampleInput] = useState<PreviewInput>(getDefaultSampleCodeInputs());
  const [previewMode, setPreviewMode] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const dirty = useMemo(() => {
    if (!savedEnvelope || !draftEnvelope) return false;
    return JSON.stringify(savedEnvelope) !== JSON.stringify(draftEnvelope);
  }, [draftEnvelope, savedEnvelope]);

  useUnsavedChangesGuard({
    enabled: dirty,
    message: "You have unsaved company code format changes. Leave without saving?",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/v1/platform/company-numbering", {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse | ApiError;
      if (cancelled) return;

      if (!response.ok || !("ok" in body) || !body.ok) {
        setError(body && "error" in body ? body.error?.message ?? "Failed to load company code settings." : "Failed to load company code settings.");
        setSavedEnvelope(null);
        setDraftEnvelope(null);
      } else {
        setSavedEnvelope(cloneEnvelope(body.data.settings));
        setDraftEnvelope(cloneEnvelope(body.data.settings));
      }

      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const readOnlyReason = useMemo(() => {
    if (canManage) return null;
    return "Read-only preview mode: only the active Master Admin (OWNER) can save company code formats.";
  }, [canManage]);

  const draftIssues = useMemo(() => (draftEnvelope ? validateCodeFormatConfig(draftEnvelope) : []), [draftEnvelope]);
  const issuesByDefinition = useMemo(() => groupedIssues(draftIssues), [draftIssues]);
  const blockingIssues = draftIssues.filter((issue) => issue.severity === "error");
  const changeSummary: ChangeSummary = useMemo(
    () =>
      draftEnvelope
        ? compareFormatConfigChanges(savedEnvelope, draftEnvelope)
        : { changedKeys: [], changedVariants: [], totalChanges: 0, lines: [] },
    [draftEnvelope, savedEnvelope],
  );

  const setDefinition = (key: CompanyCodeDefinitionKey, updater: (current: CodeFormatDefinition) => CodeFormatDefinition) => {
    setDraftEnvelope((current) => {
      if (!current) return current;
      return {
        ...current,
        definitions: current.definitions.map((definition) => (definition.key === key ? updater(definition) : definition)),
      };
    });
  };

  const loadDefaultsIntoDraft = () => {
    if (!draftEnvelope) return;
    setDraftEnvelope(loadYgenDefaults(draftEnvelope.companyId));
    setSuccess(null);
    toast.success("YGEN defaults loaded into the draft.");
  };

  const handleImport = async (file: File) => {
    if (!draftEnvelope) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const imported = toEnvelopeFromImport(parsed, draftEnvelope.companyId ?? "");
      if (!imported) {
        throw new Error("The imported file is not a valid company code settings export.");
      }
      setDraftEnvelope(imported);
      toast.success("Configuration imported into the draft.");
    } catch (importError) {
      toast.error(importError instanceof Error ? importError.message : "Import failed.");
    }
  };

  const exportDraft = () => {
    if (!draftEnvelope) return;
    const blob = new Blob([JSON.stringify(draftEnvelope, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `company-code-format-${draftEnvelope.companyId ?? "company"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    if (!canManage || !draftEnvelope) return;
    if (blockingIssues.length > 0) {
      toast.error("Resolve blocking validation issues before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/v1/platform/company-numbering", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "SAVE",
        settings: draftEnvelope,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ApiResponse | ApiError;
    if (!response.ok || !("ok" in body) || !body.ok) {
      setError(body && "error" in body ? body.error?.message ?? "Save failed." : "Save failed.");
      setSaving(false);
      return;
    }

    const nextSettings = cloneEnvelope(body.data.settings);
    setSavedEnvelope(nextSettings);
    setDraftEnvelope(cloneEnvelope(nextSettings));
    setSuccess("Company code format settings saved.");
    setSaving(false);
    toast.success("Company code format settings saved.");
    router.refresh();
  };

  const resetSavedDefaults = async () => {
    if (!canManage) return;

    setResetting(true);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/v1/platform/company-numbering", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "RESET" }),
    });
    const body = (await response.json().catch(() => ({}))) as ApiResponse | ApiError;
    if (!response.ok || !("ok" in body) || !body.ok) {
      setError(body && "error" in body ? body.error?.message ?? "Reset failed." : "Reset failed.");
      setResetting(false);
      return;
    }

    const nextSettings = cloneEnvelope(body.data.settings);
    setSavedEnvelope(nextSettings);
    setDraftEnvelope(cloneEnvelope(nextSettings));
    setResetting(false);
    setShowResetDialog(false);
    toast.success("Saved company code settings were reset to YGEN defaults.");
  };

  if (loading) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Loading company code format settings…</div>;
  }

  if (!draftEnvelope) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">No company code settings are available.</div>;
  }

  return (
    <div className="space-y-6">
      {readOnlyReason ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {readOnlyReason}
        </div>
      ) : null}
      {error ? <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {success ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
      {draftEnvelope.warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Compatibility notice
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {draftEnvelope.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="border-[hsl(var(--border)/0.82)]">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <CardTitle>Company Code Format Settings</CardTitle>
                  <CardDescription>
                    Configure YGEN quote, challan, invoice, spot sale, and budgetary format rules from one tenant-aware admin workspace.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant={previewMode ? "default" : "outline"} size="sm" onClick={() => setPreviewMode((current) => !current)}>
                    {previewMode ? "Exit preview mode" : "Preview mode"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={loadDefaultsIntoDraft} disabled={!canManage}>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Load YGEN defaults
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowSummary(true)}>
                    <Layers3 className="mr-1.5 h-4 w-4" />
                    Change summary
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2))/0.6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Status</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{blockingIssues.length === 0 ? "Ready" : "Needs fixes"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {blockingIssues.length} blocking issues, {draftIssues.length - blockingIssues.length} warnings.
                </p>
              </div>
              <div className="rounded-2xl border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2))/0.6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Saved source</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{draftEnvelope.source}</p>
                <p className="mt-1 text-sm text-muted-foreground">Rich config persists in NumberSeries metadata.</p>
              </div>
              <div className="rounded-2xl border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2))/0.6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Change set</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{changeSummary.totalChanges}</p>
                <p className="mt-1 text-sm text-muted-foreground">Tracked differences from the last saved configuration.</p>
              </div>
            </CardContent>
          </Card>

          {draftEnvelope.definitions.map((definition) => (
            <CodeFormatCard
              key={definition.key}
              definition={definition}
              allDefinitions={draftEnvelope.definitions}
              issues={issuesByDefinition[definition.key] ?? []}
              sample={sampleInput}
              previewMode={previewMode || !canManage}
              disabled={!canManage || saving || resetting}
              onDefinitionChange={(nextDefinition) => setDefinition(definition.key, () => nextDefinition)}
              onResetDefinition={() =>
                setDefinition(definition.key, () => loadYgenDefaults(draftEnvelope.companyId).definitions.find((entry) => entry.key === definition.key)!)
              }
              onCloneFromOtherType={(sourceKey) =>
                setDefinition(definition.key, (current) => {
                  const sourceDefinition = draftEnvelope.definitions.find((entry) => entry.key === sourceKey);
                  const sourceVariant =
                    sourceDefinition?.variants.find((variant) => variant.id === sourceDefinition.activeVariantId) ??
                    sourceDefinition?.variants[0];
                  if (!sourceVariant) return current;
                  const clonedVariant: CodeFormatVariant = {
                    ...sourceVariant,
                    id: `${sourceVariant.id}-${Date.now()}`,
                    label: `${sourceDefinition?.displayName ?? sourceKey} clone`,
                    notes: `Cloned from ${sourceDefinition?.displayName ?? sourceKey}.`,
                  };
                  return {
                    ...current,
                    activeVariantId: clonedVariant.id,
                    variants: [...current.variants, clonedVariant],
                  };
                })
              }
            />
          ))}
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="border-[hsl(var(--border)/0.82)]">
            <CardHeader>
              <CardTitle className="text-lg">Sample data tester</CardTitle>
              <CardDescription>Drive instant previews with seeded YGEN example values or your own test payloads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Client short code</Label>
                  <Input value={sampleInput.clientShortCode} onChange={(event) => setSampleInput((current) => ({ ...current, clientShortCode: event.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Offer number</Label>
                  <Input type="number" value={sampleInput.offerNumber} onChange={(event) => setSampleInput((current) => ({ ...current, offerNumber: Number(event.target.value || 0) }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Budgetary offer</Label>
                  <Input type="number" value={sampleInput.budgetaryOfferNumber} onChange={(event) => setSampleInput((current) => ({ ...current, budgetaryOfferNumber: Number(event.target.value || 0) }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Spot sale offer</Label>
                  <Input type="number" value={sampleInput.spotSaleOfferNumber} onChange={(event) => setSampleInput((current) => ({ ...current, spotSaleOfferNumber: Number(event.target.value || 0) }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Quote month / year</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={sampleInput.quoteMonth} onChange={(event) => setSampleInput((current) => ({ ...current, quoteMonth: event.target.value }))} />
                    <Input value={sampleInput.quoteYear} onChange={(event) => setSampleInput((current) => ({ ...current, quoteYear: event.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Delivery month / year</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={sampleInput.deliveryMonth} onChange={(event) => setSampleInput((current) => ({ ...current, deliveryMonth: event.target.value }))} />
                    <Input value={sampleInput.deliveryYear} onChange={(event) => setSampleInput((current) => ({ ...current, deliveryYear: event.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Invoice month / year</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={sampleInput.invoiceMonth} onChange={(event) => setSampleInput((current) => ({ ...current, invoiceMonth: event.target.value }))} />
                    <Input value={sampleInput.invoiceYear} onChange={(event) => setSampleInput((current) => ({ ...current, invoiceYear: event.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Sales initials</Label>
                  <Input value={sampleInput.salespersonInitials} onChange={(event) => setSampleInput((current) => ({ ...current, salespersonInitials: event.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Revision / serial</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" value={sampleInput.revisionNumber} onChange={(event) => setSampleInput((current) => ({ ...current, revisionNumber: Number(event.target.value || 0) }))} />
                    <Input type="number" value={sampleInput.serialNumber} onChange={(event) => setSampleInput((current) => ({ ...current, serialNumber: Number(event.target.value || 0) }))} />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Project serial</Label>
                  <Input type="number" value={sampleInput.projectSerialNumber} onChange={(event) => setSampleInput((current) => ({ ...current, projectSerialNumber: Number(event.target.value || 0) }))} />
                </div>
              </div>

              <Button type="button" variant="ghost" onClick={() => setSampleInput(getDefaultSampleCodeInputs())}>
                Reset sample values
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[hsl(var(--border)/0.82)]">
            <CardHeader>
              <CardTitle className="text-lg">Validation summary</CardTitle>
              <CardDescription>Errors block save. Warnings stay visible for review and audit context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draftIssues.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  All document definitions are currently valid.
                </div>
              ) : (
                draftIssues.map((issue) => (
                  <div
                    key={`${issue.key}-${issue.variantId ?? "definition"}-${issue.message}`}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm",
                      issue.severity === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-800",
                    )}
                  >
                    <p className="font-medium">{definitionKeyBadge(issue.key)}</p>
                    <p>{issue.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-[hsl(var(--border)/0.82)]">
            <CardHeader>
              <CardTitle className="text-lg">Import / export</CardTitle>
              <CardDescription>Move tenant-specific config safely without relying on browser-only storage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleImport(file);
                  }
                  event.target.value = "";
                }}
              />
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => importRef.current?.click()} disabled={!canManage}>
                <Upload className="mr-2 h-4 w-4" />
                Import JSON config
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start" onClick={exportDraft}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Export current draft
              </Button>
              <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => copyToClipboard(JSON.stringify(draftEnvelope, null, 2), "Draft JSON copied to clipboard.")}>
                <FileJson className="mr-2 h-4 w-4" />
                Copy JSON
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-4 z-20">
        <div className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border)/0.88)] bg-[hsl(var(--surface-1))/0.95] px-4 py-4 shadow-2xl backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {changeSummary.totalChanges > 0 ? `${changeSummary.totalChanges} changes ready` : "No unsaved changes"}
            </p>
            <p className="text-sm text-muted-foreground">
              {blockingIssues.length > 0
                ? `${blockingIssues.length} blocking validation issues must be fixed before save.`
                : "Config persists in NumberSeries metadata and keeps live issuance on the current compatibility allocator."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setShowSummary(true)}>
              Change summary
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowResetDialog(true)} disabled={!canManage || resetting}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset saved defaults
            </Button>
            <Button type="button" onClick={save} disabled={!canManage || saving || !dirty || blockingIssues.length > 0}>
              {saving ? "Saving..." : "Save company code settings"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change summary</DialogTitle>
            <DialogDescription>
              Review the current draft before saving. This is the same payload that will be audited with the active company configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {changeSummary.lines.length === 0 ? (
              <div className="rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))/0.62] px-4 py-3 text-sm text-muted-foreground">
                No changes from the last saved state.
              </div>
            ) : (
              changeSummary.lines.map((line) => (
                <div key={line} className="rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))/0.62] px-4 py-3 text-sm">
                  {line}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowSummary(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset saved config to YGEN defaults?"
        description="This overwrites the persisted company code format settings for the active company and stores the default YGEN configuration."
        confirmLabel={resetting ? "Resetting..." : "Reset defaults"}
        variant="danger"
        pending={resetting}
        onConfirm={resetSavedDefaults}
      />
    </div>
  );
}
