import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Work Orders"
      description="Run production orders through reservation and completion."
      apiHref="/api/v1/manufacturing/work-orders"
    />
  );
}
