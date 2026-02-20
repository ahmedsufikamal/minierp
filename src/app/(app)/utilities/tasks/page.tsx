import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Utility Tasks"
      description="Utility task orchestration and status views."
      apiHref="/api/v1/utilities/tasks"
    />
  );
}
