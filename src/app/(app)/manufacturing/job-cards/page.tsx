import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Job Cards"
      description="Track operation execution at workstation level."
      apiHref="/api/v1/manufacturing/job-cards"
    />
  );
}
