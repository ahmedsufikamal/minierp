import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Purchase Receipts"
      description="Receive goods and post inbound stock movements."
      apiHref="/api/v1/buying/purchase-receipts"
    />
  );
}
