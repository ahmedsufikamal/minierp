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

export function PartiesMasterClient() {
  const compiledQuery = useQuery({
    queryKey: queryKeys.detail("meta", "compiled", "Party"),
    queryFn: () => apiGet<CompiledMetaResponse>("/api/v1/meta/models/Party/compiled"),
    retry: false,
  });

  const fields = useMemo(() => {
    const source = compiledQuery.data?.uiSchema?.fields;
    return Array.isArray(source) ? source : [];
  }, [compiledQuery.data]);

  return (
    <div className="space-y-5">
      <ModuleWorkbenchPlaceholder
        moduleName="Master Parties"
        description="Customer and supplier golden records with dedup and merge support."
        apiHref="/api/v1/master/parties"
      />
      <DynamicForm
        schema={{ fields }}
        defaultValues={{}}
        submitLabel="Preview Party Custom Fields"
        onSubmit={async () => undefined}
      />
    </div>
  );
}
