import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Sales Orders"
      description="Manage order lifecycle and reservation-backed fulfillment."
      apiHref="/api/v1/selling/sales-orders"
    />
  );
}
