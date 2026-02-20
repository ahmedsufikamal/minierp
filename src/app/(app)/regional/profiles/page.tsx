import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Regional Profiles"
      description="Regional tax and statutory profile settings."
      apiHref="/api/v1/regional/profiles"
    />
  );
}
