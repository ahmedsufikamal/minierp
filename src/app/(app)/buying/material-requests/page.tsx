import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Material Requests"
      description="Raise and track internal material demand."
      apiHref="/api/v1/buying/material-requests"
    />
  );
}
