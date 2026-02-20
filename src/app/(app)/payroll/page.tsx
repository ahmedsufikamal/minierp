import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Payroll"
      description="Salary structures, payroll runs, and payslip controls."
      apiHref="/api/v1/payroll/entries"
    />
  );
}
