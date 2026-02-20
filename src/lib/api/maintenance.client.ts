import { createModuleApiClient } from "@/lib/api/module-client";

export const maintenanceApi = createModuleApiClient("/api/v1/maintenance");
