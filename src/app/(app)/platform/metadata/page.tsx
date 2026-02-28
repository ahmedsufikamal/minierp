import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function PlatformMetadataPage() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Metadata Studio"
      description="Manage model definitions, custom fields, workflows, print templates, and metadata audits."
      apiHref="/api/v1/meta/models"
    />
  );
}
