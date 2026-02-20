import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Buying"
      description="Procure-to-pay workspace for suppliers, RFQs, and receipts."
      apiHref="/api/v1/buying/material-requests"
    />
  );
}
