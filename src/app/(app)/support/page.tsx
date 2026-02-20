import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Support"
      description="Ticket operations with SLA and queue management."
      apiHref="/api/v1/support/tickets"
    />
  );
}
