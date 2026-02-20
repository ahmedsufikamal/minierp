import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Salary Structures"
      description="Salary components and structure assignment."
      apiHref="/api/v1/payroll/salary-structures"
    />
  );
}
