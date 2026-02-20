import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="POS Closing"
      description="Shift close reconciliation and summaries."
      apiHref="/api/v1/pos/shifts"
    />
  );
}
