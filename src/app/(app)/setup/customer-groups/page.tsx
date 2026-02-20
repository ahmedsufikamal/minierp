import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Customer Groups"
      description="Maintain customer grouping for selling and reporting."
      apiHref="/api/v1/setup/customer-groups"
    />
  );
}
