import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Routings"
      description="Define operation sequences and workstation routing."
      apiHref="/api/v1/manufacturing/routings"
    />
  );
}
