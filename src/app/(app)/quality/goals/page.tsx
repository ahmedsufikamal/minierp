import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Quality Goals"
      description="Track quality goals and feedback loops."
      apiHref="/api/v1/quality/goals"
    />
  );
}
