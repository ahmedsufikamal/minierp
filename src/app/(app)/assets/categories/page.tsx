import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Asset Categories"
      description="Asset classes and depreciation defaults."
      apiHref="/api/v1/assets/categories"
    />
  );
}
