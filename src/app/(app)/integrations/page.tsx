import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Integrations"
      description="Email, tokens, webhooks, and import/export integrations."
      apiHref="/api/v1/integrations/email-templates"
    />
  );
}
