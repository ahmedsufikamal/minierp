import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Manufacturing"
      description="Production planning, routing, and execution controls."
      apiHref="/api/v1/manufacturing/work-orders"
    />
  );
}
