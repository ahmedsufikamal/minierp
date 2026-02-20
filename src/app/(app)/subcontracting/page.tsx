import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Subcontracting"
      description="Outsourced manufacturing order and receipt controls."
      apiHref="/api/v1/subcontracting/orders"
    />
  );
}
