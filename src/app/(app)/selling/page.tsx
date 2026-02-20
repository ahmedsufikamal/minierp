import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Selling"
      description="Quote-to-cash workspace for customers, documents, and receivables."
      apiHref="/api/v1/selling/sales-orders"
    />
  );
}
