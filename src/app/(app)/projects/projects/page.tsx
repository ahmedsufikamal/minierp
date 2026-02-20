import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Projects"
      description="Project definitions and profitability tracking."
      apiHref="/api/v1/projects/projects"
    />
  );
}
