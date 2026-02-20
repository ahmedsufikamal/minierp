import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Assets"
      description="Asset register with lifecycle transitions."
      apiHref="/api/v1/assets/assets"
    />
  );
}
