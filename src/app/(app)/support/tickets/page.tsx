import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Support Tickets"
      description="Ticket intake and lifecycle operations."
      apiHref="/api/v1/support/tickets"
    />
  );
}
