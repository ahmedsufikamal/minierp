import { notFound } from "next/navigation";
import { StockPlaceholderPage } from "../../_components/stock-placeholder-page";

const setupPlaceholders = {
  "item-attribute": {
    title: "Item Attribute",
    description: "Planned stock workbench for item variant attribute definitions.",
  },
  "uom-conversion-factor": {
    title: "UOM Conversion Factor",
    description: "Planned stock workbench for unit conversion mapping and maintenance.",
  },
  "serial-no": {
    title: "Serial No",
    description: "Planned stock workbench for serial-tracked inventory records.",
  },
  "batch-no": {
    title: "Batch No",
    description: "Planned stock workbench for batch-managed inventory records.",
  },
  "serial-and-batch-bundle": {
    title: "Serial and Batch Bundle",
    description: "Planned stock workbench for bundled serial and batch assignments.",
  },
  "inventory-dimension": {
    title: "Inventory Dimension",
    description: "Planned stock workbench for inventory dimensions and tracking metadata.",
  },
  "shipping-rule": {
    title: "Shipping Rule",
    description: "Planned stock workbench for outbound shipping rules and fulfillment defaults.",
  },
  "item-alternative": {
    title: "Item Alternative",
    description: "Planned stock workbench for substitute and alternate item mappings.",
  },
  "quality-inspection-template": {
    title: "Quality Inspection Template",
    description: "Planned stock workbench for reusable quality inspection templates.",
  },
  "delivery-trip": {
    title: "Delivery Trip",
    description: "Planned stock workbench for dispatch grouping and trip scheduling.",
  },
} satisfies Record<string, { title: string; description: string }>;

type PageProps = {
  params: Promise<{ setupSlug: string }>;
};

export default async function StockSetupPlaceholderPage(props: PageProps) {
  const { setupSlug } = await props.params;
  const page = setupPlaceholders[setupSlug];

  if (!page) {
    notFound();
  }

  return <StockPlaceholderPage title={page.title} description={page.description} />;
}
