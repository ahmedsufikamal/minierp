import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="EDI Transports"
      description="Transport adapters and connectivity definitions."
      apiHref="/api/v1/edi/transports"
    />
  );
}
