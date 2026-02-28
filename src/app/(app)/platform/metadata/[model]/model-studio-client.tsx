"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { DynamicForm } from "@/components/forms/dynamic-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ModelStudioClientProps = {
  model: string;
};

type MetaModelResponse = {
  id: string;
  name: string;
  label: string;
  latestVersion: number;
  publishedVersion: number;
  fields?: Array<Record<string, unknown>>;
  workflows?: Array<Record<string, unknown>>;
  printTemplates?: Array<Record<string, unknown>>;
  permissionPolicies?: Array<Record<string, unknown>>;
};

type CompiledResponse = {
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

export function ModelStudioClient({ model }: ModelStudioClientProps) {
  const queryClient = useQueryClient();

  const modelQuery = useQuery({
    queryKey: queryKeys.detail("meta", "models", model),
    queryFn: () => apiGet<MetaModelResponse>(`/api/v1/meta/models/${encodeURIComponent(model)}`),
  });

  const compiledQuery = useQuery({
    queryKey: queryKeys.detail("meta", "compiled", model),
    queryFn: () => apiGet<CompiledResponse>(`/api/v1/meta/models/${encodeURIComponent(model)}/compiled`),
    retry: false,
  });

  const auditQuery = useQuery({
    queryKey: queryKeys.list("meta", "audit", { model }),
    queryFn: () => apiGet<Array<Record<string, unknown>>>("/api/v1/meta/audit", { query: { model, limit: 100 } }),
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/api/v1/meta/models/${encodeURIComponent(model)}`, {
        action: "PUBLISH",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.module("meta") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.detail("meta", "models", model) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.detail("meta", "compiled", model) }),
      ]);
    },
  });

  const uiFields = useMemo(() => {
    const fields = compiledQuery.data?.uiSchema?.fields;
    return Array.isArray(fields) ? fields : [];
  }, [compiledQuery.data]);

  const modelData = modelQuery.data;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{modelData?.label ?? model}</CardTitle>
            <CardDescription>Metadata Studio for model: {model}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Latest v{modelData?.latestVersion ?? "-"}</Badge>
            <Badge variant="secondary">Published v{modelData?.publishedVersion ?? "-"}</Badge>
            <Button size="sm" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              Publish
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="fields" className="space-y-3">
        <TabsList>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="templates">Print Templates</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          <DynamicForm
            schema={{ fields: uiFields }}
            defaultValues={{}}
            submitLabel="Validate Dynamic Form"
            onSubmit={async () => undefined}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Field Definitions</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                {JSON.stringify(modelData?.fields ?? [], null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow Draft/Published</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                {JSON.stringify(modelData?.workflows ?? [], null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Print Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                {JSON.stringify(modelData?.printTemplates ?? [], null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permission Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                {JSON.stringify(modelData?.permissionPolicies ?? [], null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                {JSON.stringify(auditQuery.data ?? [], null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
