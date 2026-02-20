import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Receivables"
      description="AR tracking, aging views, and dunning workflows."
      apiHref="/api/v1/selling/dunning"
    />
  );
}
