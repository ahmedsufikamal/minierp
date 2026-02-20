import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Regional"
      description="Regional profiles and localization adapters."
      apiHref="/api/v1/regional/profiles"
    />
  );
}
