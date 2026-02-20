import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Portal"
      description="Portal configuration and self-service options."
      apiHref="/api/v1/portal/configs"
    />
  );
}
