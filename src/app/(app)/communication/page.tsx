import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Communication"
      description="Communication windows and activity logs."
      apiHref="/api/v1/communication/windows"
    />
  );
}
