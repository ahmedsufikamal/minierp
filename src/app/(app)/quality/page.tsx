import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Quality"
      description="Inspection, CAPA, and quality goal management."
      apiHref="/api/v1/quality/inspections"
    />
  );
}
