import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function PlatformMasterNumberSeriesPage() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Master Number Series"
      description="Series allocation and sequence behavior for document keys."
      apiHref="/api/v1/platform/numbering"
    />
  );
}
