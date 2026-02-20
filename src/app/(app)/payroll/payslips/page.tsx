import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Payslips"
      description="Generated payslips and payout states."
      apiHref="/api/v1/payroll/payslips"
    />
  );
}
