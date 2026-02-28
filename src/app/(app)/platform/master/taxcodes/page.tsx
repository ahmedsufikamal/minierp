import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function PlatformMasterTaxCodesPage() {
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="Master Tax Codes"
      description="Tax code catalog with rates and output/input tax behavior."
      apiHref="/api/v1/master/taxcodes"
    />
  );
}
