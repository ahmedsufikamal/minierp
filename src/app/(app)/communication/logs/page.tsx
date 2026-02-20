import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Communication Logs"
      description="Auditable communication event log."
      apiHref="/api/v1/communication/logs"
    />
  );
}
