import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Timeline"
      description="Unified contact and activity timeline feed."
      apiHref="/api/v1/crm/timeline"
    />
  );
}
