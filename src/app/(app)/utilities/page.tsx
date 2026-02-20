import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Utilities"
      description="Administrative utility tasks and maintenance tooling."
      apiHref="/api/v1/utilities/tasks"
    />
  );
}
