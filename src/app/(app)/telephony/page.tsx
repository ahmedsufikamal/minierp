import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Telephony"
      description="Call log operations tied to support workflows."
      apiHref="/api/v1/telephony/call-logs"
    />
  );
}
