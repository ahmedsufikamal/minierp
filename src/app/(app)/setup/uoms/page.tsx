import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Units of Measure"
      description="Manage UOM masters and conversion factors."
      apiHref="/api/v1/setup/uoms"
    />
  );
}
