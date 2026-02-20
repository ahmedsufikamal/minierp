import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Maintenance Schedules"
      description="Recurring maintenance schedule management."
      apiHref="/api/v1/maintenance/schedules"
    />
  );
}
