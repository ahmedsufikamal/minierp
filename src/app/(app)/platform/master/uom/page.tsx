import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function PlatformMasterUomPage() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Master UOM"
      description="Units of measure and conversion factors from setup masters."
      apiHref="/api/v1/master/uom"
    />
  );
}
