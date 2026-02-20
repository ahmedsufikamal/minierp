import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Delivery Notes"
      description="Issue stock against submitted sales orders."
      apiHref="/api/v1/selling/delivery-notes"
    />
  );
}
