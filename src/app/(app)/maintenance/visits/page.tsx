import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Maintenance Visits"
      description="Maintenance visit tracking and completion."
      apiHref="/api/v1/maintenance/visits"
    />
  );
}
