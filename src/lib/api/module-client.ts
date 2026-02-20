import { apiGet, apiPatch, apiPost, type ApiRequestOptions } from "@/lib/api/client";

export function createModuleApiClient(basePath: string) {
  return {
    list<TData>(resource: string, query?: ApiRequestOptions["query"]) {
      return apiGet<TData>(`${basePath}/${resource}`, { query });
    },
    create<TData, TBody>(resource: string, body: TBody) {
      return apiPost<TData, TBody>(`${basePath}/${resource}`, body);
    },
    action<TData, TBody>(resource: string, id: string, body: TBody) {
      return apiPatch<TData, TBody>(`${basePath}/${resource}/${id}/actions`, body);
    },
  };
}
