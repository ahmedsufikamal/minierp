import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Email Queue"
      description="Queued outbound email jobs and retries."
      apiHref="/api/v1/integrations/email-queue"
    />
  );
}
