import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookCopy,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileText,
  FolderCog,
  Home,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type ShellNavItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  description?: string;
  defaultExpanded?: boolean;
  children?: ShellNavItem[];
};

export type ShellNavSection = {
  title?: string;
  items: ShellNavItem[];
};

export type ShellModule = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  homeHref: string;
  matchers: string[];
  sections: ShellNavSection[];
};

export const shellHomeItems: ShellNavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home, description: "Cross-module overview" },
  {
    label: "Dashboard",
    href: "/stock",
    icon: LayoutDashboard,
    description: "Stock workspace dashboard",
  },
];

export const shellModules: ShellModule[] = [
  {
    id: "stock",
    label: "Stock",
    description: "Stock-first workspace navigation, setup, tools, and reports",
    icon: Boxes,
    homeHref: "/stock",
    matchers: ["/stock", "/setup/item-groups", "/setup/uoms"],
    sections: [
      {
        items: [
          { label: "Stock Entry", href: "/stock/stock-entry", icon: ClipboardCheck },
          { label: "Purchase Receipt", href: "/stock/purchase-receipt", icon: Receipt },
          { label: "Delivery Note", href: "/stock/delivery-note", icon: Truck },
          { label: "Material Request", href: "/stock/material-request", icon: ClipboardList },
          { label: "Pick List", href: "/stock/pick-list", icon: Package },
        ],
      },
      {
        items: [
          {
            label: "Tools",
            icon: Wrench,
            children: [
              {
                label: "Stock Reconciliation",
                href: "/stock/tools/stock-reconciliation",
                icon: ClipboardCheck,
              },
              {
                label: "Landed Cost Voucher",
                href: "/stock/tools/landed-cost-voucher",
                icon: Wallet,
              },
              {
                label: "Repost Item Valuation",
                href: "/stock/tools/repost-item-valuation",
                icon: Wrench,
              },
              { label: "Packing Slip", href: "/stock/tools/packing-slip", icon: Package },
              {
                label: "Quality Inspection",
                href: "/stock/tools/quality-inspection",
                icon: ShieldCheck,
              },
            ],
          },
          {
            label: "Setup",
            icon: FolderCog,
            children: [
              { label: "Item", href: "/stock/setup/item", icon: Package },
              { label: "Item Group", href: "/stock/setup/item-group", icon: FolderCog },
              { label: "Item Attribute", href: "/stock/setup/item-attribute", icon: ClipboardList },
              { label: "Brand", href: "/stock/setup/brand", icon: Building2 },
              { label: "Warehouse", href: "/stock/setup/warehouse", icon: Building2 },
              { label: "Unit of Measure (UOM)", href: "/stock/setup/unit-of-measure", icon: Scale },
              {
                label: "UOM Conversion Factor",
                href: "/stock/setup/uom-conversion-factor",
                icon: Scale,
              },
              { label: "Serial No", href: "/stock/setup/serial-no", icon: FileText },
              { label: "Batch No", href: "/stock/setup/batch-no", icon: FileText },
              {
                label: "Serial and Batch Bundle",
                href: "/stock/setup/serial-and-batch-bundle",
                icon: Package,
              },
              {
                label: "Inventory Dimension",
                href: "/stock/setup/inventory-dimension",
                icon: FileText,
              },
              { label: "Shipping Rule", href: "/stock/setup/shipping-rule", icon: Truck },
              { label: "Item Alternative", href: "/stock/setup/item-alternative", icon: Package },
              {
                label: "Quality Inspection Template",
                href: "/stock/setup/quality-inspection-template",
                icon: ClipboardCheck,
              },
              { label: "Delivery Trip", href: "/stock/setup/delivery-trip", icon: Truck },
            ],
          },
          {
            label: "Reports",
            icon: FileBarChart,
            children: [
              { label: "Stock Ledger", href: "/stock/reports/stock-ledger", icon: BookCopy },
              { label: "Stock Balance", href: "/stock/reports/stock-balance", icon: FileBarChart },
              {
                label: "Quick Stock Balance",
                href: "/stock/reports/quick-stock-balance",
                icon: FileBarChart,
              },
              {
                label: "Stock Projected Qty",
                href: "/stock/reports/stock-projected-qty",
                icon: FileBarChart,
              },
              {
                label: "Stock Analytics",
                href: "/stock/reports/stock-analytics",
                icon: FileBarChart,
              },
              { label: "Stock Ageing", href: "/stock/reports/stock-ageing", icon: FileBarChart },
              {
                label: "Purchase Receipt Trends",
                href: "/stock/reports/purchase-receipt-trends",
                icon: FileBarChart,
              },
              {
                label: "Delivery Note Trends",
                href: "/stock/reports/delivery-note-trends",
                icon: FileBarChart,
              },
              {
                label: "Item Price Stock",
                href: "/stock/reports/item-price-stock",
                icon: FileBarChart,
              },
              {
                label: "Warehouse Wise Stock Balance",
                href: "/stock/reports/warehouse-wise-stock-balance",
                icon: FileBarChart,
              },
              {
                label: "Item Shortage Report",
                href: "/stock/reports/item-shortage-report",
                icon: FileBarChart,
              },
              {
                label: "Serial No and Batch Traceability",
                href: "/stock/reports/serial-no-and-batch-traceability",
                icon: FileBarChart,
              },
              {
                label: "Serial No Status",
                href: "/stock/reports/serial-no-status",
                icon: FileBarChart,
              },
              {
                label: "Serial No Ledger",
                href: "/stock/reports/serial-no-ledger",
                icon: FileBarChart,
              },
              {
                label: "Serial No Warranty Expiry",
                href: "/stock/reports/serial-no-warranty-expiry",
                icon: FileBarChart,
              },
              {
                label: "Batch-Wise Balance History",
                href: "/stock/reports/batch-wise-balance-history",
                icon: FileBarChart,
              },
              {
                label: "Batch Item Expiry Status",
                href: "/stock/reports/batch-item-expiry-status",
                icon: FileBarChart,
              },
              {
                label: "Requested Items To Be Transferred",
                href: "/stock/reports/requested-items-to-be-transferred",
                icon: FileBarChart,
              },
              {
                label: "Itemwise Recommended Reorder Level",
                href: "/stock/reports/itemwise-recommended-reorder-level",
                icon: FileBarChart,
              },
              {
                label: "Item Variant Details",
                href: "/stock/reports/item-variant-details",
                icon: FileBarChart,
              },
            ],
          },
          {
            label: "Settings",
            icon: Settings,
            children: [
              { label: "Stock Settings", href: "/stock/settings/stock-settings", icon: Settings },
              {
                label: "Item Variant Settings",
                href: "/stock/settings/item-variant-settings",
                icon: Settings,
              },
              {
                label: "Stock Reposting Settings",
                href: "/stock/settings/stock-reposting-settings",
                icon: Settings,
              },
              {
                label: "Delivery Settings",
                href: "/stock/settings/delivery-settings",
                icon: Settings,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    description: "Books, ledgers, and fiscal control",
    icon: Landmark,
    homeHref: "/accounting",
    matchers: ["/accounting"],
    sections: [
      {
        title: "Transactions",
        items: [
          { label: "Chart of Accounts", href: "/accounting/coa", icon: BookCopy },
          { label: "Journal Entries", href: "/accounting/journal-entries", icon: FileText },
          { label: "Payment Entries", href: "/accounting/payment-entries", icon: Wallet },
        ],
      },
      {
        title: "Reports",
        items: [
          { label: "General Ledger", href: "/accounting/gl", icon: FileBarChart },
          { label: "Fiscal Periods", href: "/accounting/periods", icon: ClipboardList },
        ],
      },
    ],
  },
  {
    id: "trade",
    label: "Trade Finance",
    description: "Letters of credit, document scrutiny, and settlement workflows",
    icon: Wallet,
    homeHref: "/trade/lc",
    matchers: ["/trade"],
    sections: [
      {
        items: [
          { label: "LC Dashboard", href: "/trade/lc", icon: LayoutDashboard },
          { label: "LC Register", href: "/trade/lc/register", icon: FileText },
          { label: "New LC", href: "/trade/lc/new", icon: ClipboardCheck },
          { label: "Amendments", href: "/trade/lc/amendments", icon: ClipboardList },
          { label: "Documents & Checklist", href: "/trade/lc/documents", icon: BookCopy },
          { label: "Discrepancies", href: "/trade/lc/discrepancies", icon: ShieldCheck },
          { label: "Charges & Payments", href: "/trade/lc/charges-payments", icon: Wallet },
          { label: "Reports", href: "/trade/lc/reports", icon: FileBarChart },
          { label: "Settings", href: "/trade/lc/settings", icon: FolderCog },
        ],
      },
    ],
  },
  {
    id: "buying",
    label: "Buying",
    description: "Procurement, suppliers, and inbound flow",
    icon: ShoppingCart,
    homeHref: "/buying/purchase-orders",
    matchers: ["/buying"],
    sections: [
      {
        title: "Transactions",
        items: [
          { label: "Purchase Orders", href: "/buying/purchase-orders", icon: ShoppingCart },
          { label: "Purchase Receipts", href: "/buying/purchase-receipts", icon: Receipt },
          { label: "Supplier Quotations", href: "/buying/supplier-quotations", icon: FileText },
        ],
      },
      {
        title: "Setup",
        items: [{ label: "Suppliers", href: "/buying/suppliers", icon: Users }],
      },
    ],
  },
  {
    id: "selling",
    label: "Selling",
    description: "Orders, billing, and outbound fulfilment",
    icon: Truck,
    homeHref: "/selling/sales-orders",
    matchers: ["/selling"],
    sections: [
      {
        title: "Transactions",
        items: [
          { label: "Sales Orders", href: "/selling/sales-orders", icon: ClipboardList },
          { label: "Delivery Notes", href: "/selling/delivery-notes", icon: Truck },
          { label: "Sales Invoices", href: "/selling/sales-invoices", icon: FileText },
        ],
      },
      {
        title: "Setup",
        items: [{ label: "Customers", href: "/selling/customers", icon: Users }],
      },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    description: "Metadata, master data, and workspace controls",
    icon: Settings,
    homeHref: "/platform/metadata",
    matchers: ["/platform"],
    sections: [
      {
        title: "Studio",
        items: [
          { label: "Metadata Studio", href: "/platform/metadata", icon: BookCopy },
          { label: "Master Parties", href: "/platform/master/parties", icon: Users },
          { label: "Master Items", href: "/platform/master/items", icon: Package },
        ],
      },
      {
        title: "Setup",
        items: [
          { label: "Price Lists", href: "/platform/master/pricelists", icon: Wallet },
          { label: "Currencies", href: "/platform/master/currencies", icon: Landmark },
          { label: "Tax Codes", href: "/platform/master/taxcodes", icon: Receipt },
        ],
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "User, organization, and platform administration",
    icon: UserRound,
    homeHref: "/settings/user",
    matchers: ["/settings", "/org", "/admin"],
    sections: [
      {
        title: "Personal",
        items: [
          { label: "User Settings", href: "/settings/user", icon: UserRound },
          { label: "Security", href: "/settings/user/security", icon: ShieldCheck },
          { label: "Sessions", href: "/settings/user/sessions", icon: Bell },
        ],
      },
      {
        title: "Admin",
        items: [
          { label: "Organization IAM", href: "/org/settings", icon: Building2 },
          { label: "Platform Admin", href: "/admin/users", icon: ShieldCheck },
        ],
      },
    ],
  },
];

export function resolveActiveModule(pathname: string | null | undefined): ShellModule {
  const currentPath = pathname || "/dashboard";
  const match = shellModules.find((module) =>
    module.matchers.some(
      (matcher) => currentPath === matcher || currentPath.startsWith(`${matcher}/`),
    ),
  );

  return match ?? shellModules[0];
}

export function flattenShellNavItems(): ShellNavItem[] {
  const seen = new Map<string, ShellNavItem>();

  const add = (item: ShellNavItem) => {
    if (item.href && !seen.has(item.href)) {
      seen.set(item.href, item);
    }
    for (const child of item.children ?? []) {
      add(child);
    }
  };

  for (const item of shellHomeItems) add(item);
  for (const shellModule of shellModules) {
    for (const section of shellModule.sections) {
      for (const item of section.items) {
        add(item);
      }
    }
  }

  return Array.from(seen.values());
}

export function formatModuleSubtext(input: {
  email?: string | null;
  companyLabel?: string | null;
}): string {
  if (input.companyLabel) return input.companyLabel;
  if (input.email) return input.email;
  return "Current workspace";
}
