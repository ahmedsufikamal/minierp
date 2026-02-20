import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="CRM"
      description="Lead and opportunity lifecycle with campaign and timeline context."
      apiHref="/api/v1/crm/leads"
    />
  );
}
