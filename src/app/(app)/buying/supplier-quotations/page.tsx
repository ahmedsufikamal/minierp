import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Supplier Quotations"
      description="Compare and accept supplier quotations."
      apiHref="/api/v1/buying/supplier-quotations"
    />
  );
}
