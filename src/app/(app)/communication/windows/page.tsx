import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Communication Windows"
      description="Channel schedule windows for outreach and support."
      apiHref="/api/v1/communication/windows"
    />
  );
}
