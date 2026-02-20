import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Automation Rules"
      description="Automation runtime triggers and actions."
      apiHref="/api/v1/platform/customization/automation-rules"
    />
  );
}
