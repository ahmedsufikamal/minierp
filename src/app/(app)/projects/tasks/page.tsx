import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Project Tasks"
      description="Task lifecycle across project execution."
      apiHref="/api/v1/projects/tasks"
    />
  );
}
