import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="POS"
      description="Point-of-sale profiles, shifts, and close controls."
      apiHref="/api/v1/pos/profiles"
    />
  );
}
