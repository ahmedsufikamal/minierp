import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Form Layouts"
      description="Form layout builder and section rules."
      apiHref="/api/v1/platform/customization/form-layouts"
    />
  );
}
