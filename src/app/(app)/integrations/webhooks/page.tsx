import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Webhooks"
      description="Outbound event webhook subscriptions and delivery."
      apiHref="/api/v1/integrations/api-tokens"
    />
  );
}
