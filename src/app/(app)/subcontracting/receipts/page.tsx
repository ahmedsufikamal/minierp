import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Subcontracting Receipts"
      description="Record subcontracted output and inward materials."
      apiHref="/api/v1/subcontracting/receipts"
    />
  );
}
