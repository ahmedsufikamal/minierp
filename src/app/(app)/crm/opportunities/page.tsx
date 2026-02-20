import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Opportunities"
      description="Track opportunity pipeline stages and ownership."
      apiHref="/api/v1/crm/opportunities"
    />
  );
}
