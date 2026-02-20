import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="SLA Policies"
      description="SLA definitions with pause/resume behavior."
      apiHref="/api/v1/support/sla-policies"
    />
  );
}
