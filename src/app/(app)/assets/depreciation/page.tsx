import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Depreciation"
      description="Depreciation schedule and posting controls."
      apiHref="/api/v1/assets/assets"
    />
  );
}
