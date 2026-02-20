import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Pipeline"
      description="Visual pipeline board with stage-history controls."
      apiHref="/api/v1/crm/opportunities"
    />
  );
}
