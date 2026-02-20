import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Admin Tools"
      description="Utility admin operations and diagnostics."
      apiHref="/api/v1/utilities/tasks"
    />
  );
}
