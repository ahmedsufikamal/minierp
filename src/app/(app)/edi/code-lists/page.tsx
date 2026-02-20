import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="EDI Code Lists"
      description="EDI code list management for mappings."
      apiHref="/api/v1/edi/code-lists"
    />
  );
}
