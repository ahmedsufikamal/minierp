import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="API Tokens"
      description="Scoped token issuance and revocation."
      apiHref="/api/v1/integrations/api-tokens"
    />
  );
}
