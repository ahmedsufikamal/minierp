import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardCheck,
  Building2,
  FileCheck,
  FileText,
  FolderSync,
  HandCoins,
  PackageCheck,
  Package,
  ScanBarcode,
  Receipt,
  Settings,
  ShoppingCart,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    title: "Sales",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/quotes", label: "Quotes", icon: FileCheck },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/payments", label: "Payments", icon: Wallet },
    ],
  },
  {
    title: "Purchases",
    items: [
      { href: "/vendors", label: "Vendors", icon: Building2 },
      { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
      { href: "/bills", label: "Bills", icon: Receipt },
      { href: "/payments", label: "Payments", icon: HandCoins },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/inventory", label: "Overview", icon: Boxes },
      { href: "/inventory/items", label: "Items", icon: Package },
      { href: "/inventory/warehouses", label: "Warehouses", icon: Building2 },
      { href: "/inventory/documents", label: "Documents", icon: ClipboardCheck },
      { href: "/inventory/ledger", label: "Ledger", icon: FolderSync },
      { href: "/inventory/reorder", label: "Reorder", icon: PackageCheck },
      { href: "/inventory/import", label: "Import Jobs", icon: Activity },
      { href: "/inventory/settings", label: "Settings", icon: ScanBarcode },
    ],
  },
  {
    title: "Accounting",
    items: [
      { href: "/accounting", label: "Chart of Accounts", icon: BookOpen },
      { href: "/accounting", label: "Journal Entries", icon: FileText },
      { href: "/accounting", label: "Ledger", icon: BarChart3 },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/settings", label: "Automation", icon: UserRound },
    ],
  },
];
