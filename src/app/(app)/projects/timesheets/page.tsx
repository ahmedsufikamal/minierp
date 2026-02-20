import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Timesheets"
      description="Timesheet entry and approval flow."
      apiHref="/api/v1/projects/timesheets"
    />
  );
}
