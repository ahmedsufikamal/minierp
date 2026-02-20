import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Bulk Jobs"
      description="Bulk transaction execution queue and logs."
      apiHref="/api/v1/bulk/jobs"
    />
  );
}
