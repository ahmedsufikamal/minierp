import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="POS Shifts"
      description="Shift open/close operations."
      apiHref="/api/v1/pos/shifts"
    />
  );
}
