import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Setup"
      description="Master data and global setup controls for ERP modules."
      apiHref="/api/v1/setup/item-groups"
    />
  );
}
