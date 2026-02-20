import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Validation Rules"
      description="Declarative validation and guardrail definitions."
      apiHref="/api/v1/platform/customization/validation-rules"
    />
  );
}
