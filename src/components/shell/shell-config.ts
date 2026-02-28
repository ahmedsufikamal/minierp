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
  href: string;
  icon: LucideIcon;
  description?: string;
  children?: ShellNavItem[];
};

export type ShellNavSection = {
  title: string;
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
  { label: "Dashboard", href: "/stock", icon: LayoutDashboard, description: "Stock workspace dashboard" },
];

export const shellModules: ShellModule[] = [
  {
    id: "stock",
    label: "Stock",
    description: "Inventory workspace and warehouse operations",
    icon: Boxes,
    homeHref: "/stock",
    matchers: ["/stock", "/setup/item-groups", "/setup/uoms"],
    sections: [
      {
        title: "Transactions",
        items: [
          { label: "Stock Home", href: "/stock", icon: Boxes },
          { label: "Stock Entry", href: "/stock/documents", icon: ClipboardCheck },
          { label: "Purchase Receipt", href: "/buying/purchase-receipts", icon: Receipt },
          { label: "Delivery Note", href: "/selling/delivery-notes", icon: Truck },
          { label: "Material Request", href: "/buying/material-requests", icon: ClipboardList },
          { label: "Pick List", href: "/stock/documents", icon: Package },
        ],
      },
      {
        title: "Tools",
        items: [
          { label: "Stock Ledger", href: "/stock/ledger", icon: BookCopy },
          { label: "Stock Balance", href: "/reports/stock-balance", icon: FileBarChart },
          { label: "Warehouse Ops", href: "/stock/admin/variance", icon: Wrench },
        ],
      },
      {
        title: "Setup",
        items: [
          {
            label: "Items",
            href: "/stock/items",
            icon: Package,
            children: [
              { label: "Item Group", href: "/setup/item-groups", icon: FolderCog },
              { label: "Brand", href: "/products", icon: Building2 },
            ],
          },
          { label: "Warehouse", href: "/stock/warehouses", icon: Building2 },
          { label: "UoM", href: "/setup/uoms", icon: Scale },
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

export const shellQuickActions: ShellNavItem[] = [
  { label: "Search", href: "#search", icon: LayoutDashboard, description: "Search commands and records" },
  { label: "Notifications", href: "/settings/user", icon: Bell, description: "Recent activity and alerts" },
];

export function resolveActiveModule(pathname: string | null | undefined): ShellModule {
  const currentPath = pathname || "/dashboard";
  const match = shellModules.find((module) =>
    module.matchers.some((matcher) => currentPath === matcher || currentPath.startsWith(`${matcher}/`)),
  );

  return match ?? shellModules[0];
}

export function flattenShellNavItems(): ShellNavItem[] {
  const seen = new Map<string, ShellNavItem>();

  const add = (item: ShellNavItem) => {
    if (!seen.has(item.href)) {
      seen.set(item.href, item);
    }
    for (const child of item.children ?? []) {
      add(child);
    }
  };

  for (const item of shellHomeItems) add(item);
  for (const module of shellModules) {
    for (const section of module.sections) {
      for (const item of section.items) {
        add(item);
      }
    }
  }

  return Array.from(seen.values());
}

export function formatModuleSubtext(input: { email?: string | null; companyLabel?: string | null }): string {
  if (input.companyLabel) return input.companyLabel;
  if (input.email) return input.email;
  return "Current workspace";
}
