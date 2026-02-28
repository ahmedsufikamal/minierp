"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DynamicField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  ui?: Record<string, unknown> | null;
};

type DynamicFormProps = {
  schema: {
    fields?: DynamicField[];
  };
  defaultValues?: Record<string, unknown>;
  submitLabel?: string;
  busy?: boolean;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
};

function normalizeInitialValues(input: Record<string, unknown> | undefined, fields: DynamicField[]): Record<string, unknown> {
  const base = { ...(input ?? {}) };
  for (const field of fields) {
    if (!(field.key in base)) {
      base[field.key] = field.type === "BOOLEAN" ? false : "";
    }
  }
  return base;
}

export function DynamicForm({ schema, defaultValues, submitLabel = "Save", busy = false, onSubmit }: DynamicFormProps) {
  const fields = useMemo(() => schema.fields ?? [], [schema.fields]);
  const [values, setValues] = useState<Record<string, unknown>>(() => normalizeInitialValues(defaultValues, fields));
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const missing = fields.find((field) => {
      if (!field.required) return false;
      const value = values[field.key];
      return value === null || value === undefined || value === "";
    });

    if (missing) {
      setError(`'${missing.label}' is required`);
      return;
    }

    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit dynamic form");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border p-4">
      <div>
        <h3 className="text-sm font-semibold">Dynamic Fields</h3>
        <p className="text-xs text-muted-foreground">Rendered from published compiled metadata.</p>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dynamic fields are published for this model.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => {
            const value = values[field.key];
            const inputType = field.type === "NUMBER" || field.type === "CURRENCY" ? "number" : "text";
            const readOnly = busy || field.readOnly;

            if (field.type === "BOOLEAN") {
              return (
                <label key={field.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => setField(field.key, event.target.checked)}
                    disabled={readOnly}
                  />
                  <span>{field.label}</span>
                </label>
              );
            }

            if (field.type === "JSON") {
              return (
                <div key={field.key} className="space-y-2 md:col-span-2">
                  <Label htmlFor={`dynamic-${field.key}`}>{field.label}</Label>
                  <textarea
                    id={`dynamic-${field.key}`}
                    className="h-28 w-full rounded-md border bg-background p-2 font-mono text-xs"
                    value={typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)}
                    onChange={(event) => setField(field.key, event.target.value)}
                    readOnly={readOnly}
                  />
                </div>
              );
            }

            return (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`dynamic-${field.key}`}>{field.label}</Label>
                <Input
                  id={`dynamic-${field.key}`}
                  type={inputType}
                  value={value === null || value === undefined ? "" : String(value)}
                  onChange={(event) => setField(field.key, inputType === "number" ? Number(event.target.value) : event.target.value)}
                  readOnly={readOnly}
                />
              </div>
            );
          })}
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
