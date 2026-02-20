import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Supplier Groups"
      description="Maintain supplier grouping for buying workflows."
      apiHref="/api/v1/setup/supplier-groups"
    />
  );
}
