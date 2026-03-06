import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function Page() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Ops Inbox"
      description="Prioritized operational tasks and exceptions across buying, stock, selling, and support."
      apiHref="/api/v1/ops/inbox"
      headerVariant="erp-list"
      breadcrumbTrail={["Operations", "Ops Inbox"]}
      primaryActionLabel="Open Recommendations"
      primaryActionHref="/ops/recommendations"
      enableSavedFilters
    />
  );
}
