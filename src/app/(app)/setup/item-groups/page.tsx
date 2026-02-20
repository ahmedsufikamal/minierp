import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Item Groups"
      description="Maintain item group hierarchy used by stock and buying."
      apiHref="/api/v1/setup/item-groups"
    />
  );
}
