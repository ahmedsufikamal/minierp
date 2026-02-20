import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="CAPA"
      description="Corrective and preventive action workflow."
      apiHref="/api/v1/quality/capas"
    />
  );
}
