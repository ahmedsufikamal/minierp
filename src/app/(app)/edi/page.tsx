import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="EDI"
      description="EDI code lists, transport adapters, and mapping controls."
      apiHref="/api/v1/edi/code-lists"
    />
  );
}
