import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Print Templates"
      description="Document print template management."
      apiHref="/api/v1/platform/customization/print-templates"
    />
  );
}
