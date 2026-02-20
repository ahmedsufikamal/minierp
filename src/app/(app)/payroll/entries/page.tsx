import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Payroll Entries"
      description="Payroll run orchestration and validation."
      apiHref="/api/v1/payroll/entries"
    />
  );
}
