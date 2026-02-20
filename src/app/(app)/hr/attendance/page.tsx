import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Attendance"
      description="Attendance capture and correction workflow."
      apiHref="/api/v1/hr/attendance"
    />
  );
}
