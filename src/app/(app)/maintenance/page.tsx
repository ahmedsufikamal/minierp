import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Maintenance"
      description="Maintenance schedules and visits for asset operations."
      apiHref="/api/v1/maintenance/schedules"
    />
  );
}
