import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function PlatformMasterCurrenciesPage() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Master Currencies"
      description="Currency definitions for company master data and pricing."
      apiHref="/api/v1/master/currencies"
    />
  );
}
