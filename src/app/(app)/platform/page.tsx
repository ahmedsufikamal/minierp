import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Platform"
      description="Platform-level tenancy, reporting, and customization controls."
      apiHref="/api/v1/platform/reports"
    />
  );
}
