export const queryKeys = {
  module: (moduleName: string) => [moduleName] as const,
  list: (moduleName: string, resource: string, query?: Record<string, unknown>) =>
    [moduleName, resource, "list", query ?? {}] as const,
  detail: (moduleName: string, resource: string, id: string) =>
    [moduleName, resource, "detail", id] as const,
  action: (moduleName: string, resource: string, id: string, action: string) =>
    [moduleName, resource, "action", id, action] as const,
};
