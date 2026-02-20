import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Support Queues"
      description="Queue setup and assignment controls."
      apiHref="/api/v1/support/queues"
    />
  );
}
