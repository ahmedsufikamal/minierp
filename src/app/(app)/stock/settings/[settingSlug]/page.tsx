import { notFound } from "next/navigation";
import { StockPlaceholderPage } from "../../_components/stock-placeholder-page";

const settingPlaceholders = {
  "item-variant-settings": {
    title: "Item Variant Settings",
    description: "Planned stock settings page for variant-specific stock configuration.",
  },
  "stock-reposting-settings": {
    title: "Stock Reposting Settings",
    description: "Planned stock settings page for reposting and valuation rebuild controls.",
  },
  "delivery-settings": {
    title: "Delivery Settings",
    description: "Planned stock settings page for outbound delivery defaults and controls.",
  },
} satisfies Record<string, { title: string; description: string }>;

type PageProps = {
  params: Promise<{ settingSlug: string }>;
};

export default async function StockSettingPlaceholderPage(props: PageProps) {
  const { settingSlug } = await props.params;
  const page = settingPlaceholders[settingSlug as keyof typeof settingPlaceholders];

  if (!page) {
    notFound();
  }

  return <StockPlaceholderPage title={page.title} description={page.description} />;
}
