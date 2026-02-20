import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Subcontracting Orders"
      description="Track material outward and subcontracting commitments."
      apiHref="/api/v1/subcontracting/orders"
    />
  );
}
