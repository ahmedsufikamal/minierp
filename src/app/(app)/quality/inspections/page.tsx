import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Quality Inspections"
      description="Capture pass/fail inspection checkpoints."
      apiHref="/api/v1/quality/inspections"
    />
  );
}
