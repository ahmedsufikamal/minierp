import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Field Rules"
      description="Property override rules for fields, forms, and list actions."
      apiHref="/api/v1/platform/customization/field-rules"
    />
  );
}
