import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Projects"
      description="Projects, tasks, timesheets, and billing coverage."
      apiHref="/api/v1/projects/projects"
    />
  );
}
