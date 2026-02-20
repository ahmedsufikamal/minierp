import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Call Logs"
      description="Inbound and outbound call event tracking."
      apiHref="/api/v1/telephony/call-logs"
    />
  );
}
