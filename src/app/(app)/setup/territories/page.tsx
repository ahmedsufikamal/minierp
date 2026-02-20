import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Territories"
      description="Configure sales and customer territory structures."
      apiHref="/api/v1/setup/territories"
    />
  );
}
