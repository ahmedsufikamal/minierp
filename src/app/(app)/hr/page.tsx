import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="HR"
      description="Employee, leave, attendance, and claims workspace."
      apiHref="/api/v1/hr/employees"
    />
  );
}
