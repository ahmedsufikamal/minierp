import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Knowledge Base"
      description="Knowledge authoring and retrieval workflows."
      apiHref="/api/v1/support/tickets"
    />
  );
}
