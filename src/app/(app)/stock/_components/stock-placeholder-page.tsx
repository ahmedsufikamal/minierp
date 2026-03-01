import PageHeader from "@/components/page-header";
import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

type StockPlaceholderPageProps = {
  title: string;
  description?: string;
};

const defaultDescription =
  "Planned stock workbench for the canonical Stock navigation. The dedicated workflow will be added here.";

export function StockPlaceholderPage({
  title,
  description = defaultDescription,
}: StockPlaceholderPageProps) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle={description} />
      <ModuleWorkbenchPlaceholder
        moduleName={title}
        description={`${description} This placeholder keeps the new Stock route structure stable.`}
      />
    </div>
  );
}
