import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Leaves"
      description="Leave allocations and leave applications."
      apiHref="/api/v1/hr/leaves/allocations"
    />
  );
}
