import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Leads"
      description="Capture and qualify inbound sales leads."
      apiHref="/api/v1/crm/leads"
    />
  );
}
