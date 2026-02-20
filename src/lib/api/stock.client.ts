import { createModuleApiClient } from "@/lib/api/module-client";

export const stockApi = createModuleApiClient("/api/v1/inventory");
