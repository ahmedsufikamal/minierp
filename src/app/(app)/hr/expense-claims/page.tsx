import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Expense Claims"
      description="Expense claim submission and approvals."
      apiHref="/api/v1/hr/expense-claims"
    />
  );
}
