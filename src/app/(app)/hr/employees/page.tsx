import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Employees"
      description="Employee master records and employment details."
      apiHref="/api/v1/hr/employees"
    />
  );
}
