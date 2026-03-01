import { notFound } from "next/navigation";
import { StockPlaceholderPage } from "../../_components/stock-placeholder-page";

const toolPlaceholders = {
  "stock-reconciliation": {
    title: "Stock Reconciliation",
    description: "Planned stock workbench for adjustment review and reconciliation posting.",
  },
  "landed-cost-voucher": {
    title: "Landed Cost Voucher",
    description:
      "Planned stock workbench for allocating inbound landed costs across received items.",
  },
  "packing-slip": {
    title: "Packing Slip",
    description: "Planned stock workbench for packing manifests and shipment preparation.",
  },
} satisfies Record<string, { title: string; description: string }>;

type PageProps = {
  params: Promise<{ toolSlug: string }>;
};

export default async function StockToolPlaceholderPage(props: PageProps) {
  const { toolSlug } = await props.params;
  const page = toolPlaceholders[toolSlug];

  if (!page) {
    notFound();
  }

  return <StockPlaceholderPage title={page.title} description={page.description} />;
}
