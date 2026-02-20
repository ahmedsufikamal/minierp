import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Custom Fields"
      description="Custom field definitions across module entities."
      apiHref="/api/v1/platform/customization/custom-fields"
    />
  );
}
