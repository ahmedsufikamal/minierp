import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Request for Quotations"
      description="Manage RFQ dispatch and supplier response flow."
      apiHref="/api/v1/buying/rfqs"
    />
  );
}
