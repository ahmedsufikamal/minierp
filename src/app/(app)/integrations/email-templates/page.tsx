import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Email Templates"
      description="Templated outbound communication definitions."
      apiHref="/api/v1/integrations/email-templates"
    />
  );
}
