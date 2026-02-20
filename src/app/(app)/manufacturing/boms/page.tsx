import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="BOMs"
      description="Manage bill of materials structures and revisions."
      apiHref="/api/v1/manufacturing/boms"
    />
  );
}
