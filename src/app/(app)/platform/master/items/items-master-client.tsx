"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";
import { DynamicForm } from "@/components/forms/dynamic-form";

type CompiledMetaResponse = {
  uiSchema?: {
    fields?: Array<{
      key: string;
      label: string;
      type?: string;
      required?: boolean;
      readOnly?: boolean;
    }>;
  };
};

export function ItemsMasterClient() {
  const compiledQuery = useQuery({
    queryKey: queryKeys.detail("meta", "compiled", "Item"),
    queryFn: () => apiGet<CompiledMetaResponse>("/api/v1/meta/models/Item/compiled"),
    retry: false,
  });

  const fields = useMemo(() => {
    const source = compiledQuery.data?.uiSchema?.fields;
    return Array.isArray(source) ? source : [];
  }, [compiledQuery.data]);

  return (
    <div className="space-y-5">
      <ModuleWorkbenchPlaceholder
        moduleName="Master Items"
        description="Item and product master data with dynamic custom fields and barcode search."
        apiHref="/api/v1/master/items"
      />
      <DynamicForm
        schema={{ fields }}
        defaultValues={{}}
        submitLabel="Preview Item Custom Fields"
        onSubmit={async () => undefined}
      />
    </div>
  );
}
