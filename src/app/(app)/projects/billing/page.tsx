import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Project Billing"
      description="Billable effort and project invoice linkage."
      apiHref="/api/v1/projects/timesheets"
    />
  );
}
