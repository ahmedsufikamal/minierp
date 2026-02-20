import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="POS Profiles"
      description="POS terminal profiles and controls."
      apiHref="/api/v1/pos/profiles"
    />
  );
}
