import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="EDI Mappings"
      description="Document mapping configurations and transforms."
      apiHref="/api/v1/edi/code-lists"
    />
  );
}
