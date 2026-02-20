import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Payables"
      description="AP aging and supplier payment operations."
      apiHref="/api/v1/buying/supplier-payments"
    />
  );
}
