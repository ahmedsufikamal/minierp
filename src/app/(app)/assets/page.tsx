import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Assets"
      description="Asset lifecycle and depreciation operations."
      apiHref="/api/v1/assets/assets"
    />
  );
}
