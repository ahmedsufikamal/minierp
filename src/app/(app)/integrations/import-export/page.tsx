import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Import / Export"
      description="Data transfer jobs for bulk integration."
      apiHref="/api/v1/integrations/email-queue"
    />
  );
}
