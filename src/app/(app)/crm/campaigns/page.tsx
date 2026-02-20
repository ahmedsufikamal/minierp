import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Campaigns"
      description="Plan campaigns and connect execution context."
      apiHref="/api/v1/crm/campaigns"
    />
  );
}
