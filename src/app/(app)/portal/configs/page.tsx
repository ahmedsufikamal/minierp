import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Portal Configs"
      description="Customer and supplier portal behavior settings."
      apiHref="/api/v1/portal/configs"
    />
  );
}
