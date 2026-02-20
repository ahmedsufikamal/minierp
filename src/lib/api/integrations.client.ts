import { createModuleApiClient } from "@/lib/api/module-client";

export const integrationsApi = createModuleApiClient("/api/v1/integrations");
