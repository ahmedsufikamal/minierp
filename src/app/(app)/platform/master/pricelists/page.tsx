import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function PlatformMasterPriceListsPage() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Master Price Lists"
      description="Price list definitions and price items with publish lifecycle support."
      apiHref="/api/v1/master/pricelists"
    />
  );
}
