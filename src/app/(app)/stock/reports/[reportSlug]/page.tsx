import { notFound } from "next/navigation";
import { StockPlaceholderPage } from "../../_components/stock-placeholder-page";

const reportPlaceholders = {
  "stock-balance": {
    title: "Stock Balance",
    description: "Planned stock report for on-hand quantity and value by item and warehouse.",
  },
  "quick-stock-balance": {
    title: "Quick Stock Balance",
    description: "Planned stock report for fast balance lookups across active warehouses.",
  },
  "stock-projected-qty": {
    title: "Stock Projected Qty",
    description: "Planned stock report for projected quantity after pending inflow and outflow.",
  },
  "stock-analytics": {
    title: "Stock Analytics",
    description: "Planned stock report for inventory trends and stock behavior analytics.",
  },
  "stock-ageing": {
    title: "Stock Ageing",
    description: "Planned stock report for ageing analysis across batches and valuation layers.",
  },
  "purchase-receipt-trends": {
    title: "Purchase Receipt Trends",
    description: "Planned stock report for inbound receipt volume trends over time.",
  },
  "delivery-note-trends": {
    title: "Delivery Note Trends",
    description: "Planned stock report for outbound fulfillment trends over time.",
  },
  "item-price-stock": {
    title: "Item Price Stock",
    description: "Planned stock report combining item prices with stock visibility.",
  },
  "warehouse-wise-stock-balance": {
    title: "Warehouse Wise Stock Balance",
    description: "Planned stock report for warehouse-level quantity and value balances.",
  },
  "item-shortage-report": {
    title: "Item Shortage Report",
    description: "Planned stock report for shortages against demand and reservations.",
  },
  "serial-no-and-batch-traceability": {
    title: "Serial No and Batch Traceability",
    description: "Planned stock report for serial and batch traceability across movements.",
  },
  "serial-no-status": {
    title: "Serial No Status",
    description: "Planned stock report for current serial number status and availability.",
  },
  "serial-no-ledger": {
    title: "Serial No Ledger",
    description: "Planned stock report for serial number movement history.",
  },
  "serial-no-warranty-expiry": {
    title: "Serial No Warranty Expiry",
    description: "Planned stock report for serial warranty expiry tracking.",
  },
  "batch-wise-balance-history": {
    title: "Batch-Wise Balance History",
    description: "Planned stock report for historical batch balance snapshots.",
  },
  "batch-item-expiry-status": {
    title: "Batch Item Expiry Status",
    description: "Planned stock report for upcoming batch expiries and status.",
  },
  "requested-items-to-be-transferred": {
    title: "Requested Items To Be Transferred",
    description: "Planned stock report for requested transfer demand by source and destination.",
  },
  "item-variant-details": {
    title: "Item Variant Details",
    description: "Planned stock report for variant item definitions and attributes.",
  },
} satisfies Record<string, { title: string; description: string }>;

type PageProps = {
  params: Promise<{ reportSlug: string }>;
};

export default async function StockReportPlaceholderPage(props: PageProps) {
  const { reportSlug } = await props.params;
  const page = reportPlaceholders[reportSlug as keyof typeof reportPlaceholders];

  if (!page) {
    notFound();
  }

  return <StockPlaceholderPage title={page.title} description={page.description} />;
}
