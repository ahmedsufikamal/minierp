import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="POS Sales"
      description="POS sale capture and posting flow."
      apiHref="/api/v1/pos/sales"
    />
  );
}
