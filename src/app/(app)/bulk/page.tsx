import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Bulk"
      description="Bulk transaction jobs and execution diagnostics."
      apiHref="/api/v1/bulk/jobs"
    />
  );
}
