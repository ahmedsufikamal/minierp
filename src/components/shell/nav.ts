import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Banknote,
  BarChart3,
  BookCopy,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Contact,
  Factory,
  FileCheck,
  FileCode2,
  FileText,
  FolderCog,
  GanttChartSquare,
  Globe2,
  HandCoins,
  Headphones,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Package,
  PhoneCall,
  Receipt,
  Scale,
  Settings,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Ticket,
  Truck,
  UserRound,
  Users,
  Wallet,
  Wrench,
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

export const primaryNavItem: NavItem = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard };

export const navGroups: NavGroup[] = [
  {
    title: "Setup",
    items: [
      { href: "/setup/item-groups", label: "Item Groups", icon: FolderCog },
      { href: "/setup/uoms", label: "UOMs", icon: Scale },
      { href: "/setup/territories", label: "Territories", icon: Globe2 },
      { href: "/setup/customer-groups", label: "Customer Groups", icon: Users },
      { href: "/setup/supplier-groups", label: "Supplier Groups", icon: Truck },
    ],
  },
  {
    title: "Selling",
    items: [
      { href: "/selling/customers", label: "Customers", icon: Users },
      { href: "/selling/quotations", label: "Quotations", icon: FileCheck },
      { href: "/selling/sales-orders", label: "Sales Orders", icon: ClipboardList },
      { href: "/selling/delivery-notes", label: "Delivery Notes", icon: Package },
      { href: "/selling/sales-invoices", label: "Sales Invoices", icon: FileText },
      { href: "/selling/receivables", label: "Receivables", icon: Wallet },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/crm/leads", label: "Leads", icon: Contact },
      { href: "/crm/opportunities", label: "Opportunities", icon: Briefcase },
      { href: "/crm/pipeline", label: "Pipeline", icon: GanttChartSquare },
      { href: "/crm/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/crm/timeline", label: "Timeline", icon: Activity },
    ],
  },
  {
    title: "Buying",
    items: [
      { href: "/buying/suppliers", label: "Suppliers", icon: Building2 },
      { href: "/buying/material-requests", label: "Material Requests", icon: ListChecks },
      { href: "/buying/rfqs", label: "RFQs", icon: FileCheck },
      { href: "/buying/supplier-quotations", label: "Supplier Quotations", icon: Receipt },
      { href: "/buying/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
      { href: "/buying/purchase-receipts", label: "Purchase Receipts", icon: ClipboardCheck },
      { href: "/buying/purchase-invoices", label: "Purchase Invoices", icon: FileText },
      { href: "/buying/payables", label: "Payables", icon: HandCoins },
    ],
  },
  {
    title: "Stock",
    items: [
      { href: "/stock", label: "Overview", icon: Boxes },
      { href: "/stock/items", label: "Items", icon: Package },
      { href: "/stock/warehouses", label: "Warehouses", icon: Building2 },
      { href: "/stock/documents", label: "Documents", icon: ClipboardCheck },
      { href: "/stock/ledger", label: "Ledger", icon: BookOpen },
      { href: "/stock/reorder", label: "Reorder", icon: ClipboardList },
      { href: "/stock/settings", label: "Settings", icon: Settings2 },
    ],
  },
  {
    title: "Accounting",
    items: [
      { href: "/accounting/coa", label: "Chart of Accounts", icon: Landmark },
      { href: "/accounting/journal-entries", label: "Journal Entries", icon: FileText },
      { href: "/accounting/gl", label: "General Ledger", icon: BookOpen },
      { href: "/accounting/periods", label: "Fiscal Periods", icon: Activity },
      { href: "/accounting/payment-entries", label: "Payment Entries", icon: Banknote },
    ],
  },
  {
    title: "Manufacturing",
    items: [
      { href: "/manufacturing/boms", label: "BOMs", icon: BookCopy },
      { href: "/manufacturing/routings", label: "Routings", icon: GanttChartSquare },
      { href: "/manufacturing/work-orders", label: "Work Orders", icon: Factory },
      { href: "/manufacturing/job-cards", label: "Job Cards", icon: ClipboardList },
      { href: "/subcontracting/orders", label: "Subcontracting Orders", icon: Truck },
      { href: "/subcontracting/receipts", label: "Subcontracting Receipts", icon: Receipt },
    ],
  },
  {
    title: "Quality & Projects",
    items: [
      { href: "/quality/inspections", label: "Quality Inspections", icon: ClipboardCheck },
      { href: "/quality/capas", label: "CAPA", icon: Wrench },
      { href: "/quality/goals", label: "Quality Goals", icon: ListChecks },
      { href: "/projects/projects", label: "Projects", icon: Briefcase },
      { href: "/projects/tasks", label: "Tasks", icon: ClipboardList },
      { href: "/projects/timesheets", label: "Timesheets", icon: Activity },
      { href: "/projects/billing", label: "Project Billing", icon: Wallet },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/support/queues", label: "Queues", icon: Ticket },
      { href: "/support/slas", label: "SLA Policies", icon: Activity },
      { href: "/support/tickets", label: "Tickets", icon: Headphones },
      { href: "/support/knowledge-base", label: "Knowledge Base", icon: BookOpen },
      { href: "/communication/windows", label: "Communication Windows", icon: FileText },
      { href: "/communication/logs", label: "Communication Logs", icon: Activity },
      { href: "/telephony/call-logs", label: "Call Logs", icon: PhoneCall },
    ],
  },
  {
    title: "HR, Payroll, Assets",
    items: [
      { href: "/hr/employees", label: "Employees", icon: Users },
      { href: "/hr/leaves", label: "Leaves", icon: ClipboardList },
      { href: "/hr/attendance", label: "Attendance", icon: Activity },
      { href: "/hr/expense-claims", label: "Expense Claims", icon: Receipt },
      { href: "/payroll/salary-structures", label: "Salary Structures", icon: FileText },
      { href: "/payroll/entries", label: "Payroll Entries", icon: Wallet },
      { href: "/payroll/payslips", label: "Payslips", icon: FileCheck },
      { href: "/assets/categories", label: "Asset Categories", icon: FolderCog },
      { href: "/assets/assets", label: "Assets", icon: Package },
      { href: "/assets/depreciation", label: "Depreciation", icon: BarChart3 },
      { href: "/maintenance/schedules", label: "Maintenance Schedules", icon: Settings2 },
      { href: "/maintenance/visits", label: "Maintenance Visits", icon: Wrench },
      { href: "/regional/profiles", label: "Regional Profiles", icon: Globe2 },
    ],
  },
  {
    title: "POS, Portal, Integrations",
    items: [
      { href: "/pos/profiles", label: "POS Profiles", icon: Settings2 },
      { href: "/pos/shifts", label: "POS Shifts", icon: Activity },
      { href: "/pos/sales", label: "POS Sales", icon: ShoppingCart },
      { href: "/pos/closing", label: "POS Closing", icon: Wallet },
      { href: "/portal/configs", label: "Portal Configs", icon: Settings },
      { href: "/integrations/email-templates", label: "Email Templates", icon: FileCode2 },
      { href: "/integrations/email-queue", label: "Email Queue", icon: Activity },
      { href: "/integrations/api-tokens", label: "API Tokens", icon: ShieldCheck },
      { href: "/integrations/webhooks", label: "Webhooks", icon: Activity },
      { href: "/integrations/import-export", label: "Import / Export", icon: Truck },
      { href: "/edi/code-lists", label: "EDI Code Lists", icon: BookOpen },
      { href: "/edi/transports", label: "EDI Transports", icon: Activity },
      { href: "/edi/mappings", label: "EDI Mappings", icon: FileCode2 },
      { href: "/bulk/jobs", label: "Bulk Jobs", icon: Boxes },
      { href: "/utilities/tasks", label: "Utility Tasks", icon: Wrench },
      { href: "/utilities/admin-tools", label: "Admin Tools", icon: Settings2 },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/platform/reports", label: "Reports", icon: BarChart3 },
      { href: "/platform/settings", label: "Settings", icon: Settings },
      { href: "/platform/customization/custom-fields", label: "Custom Fields", icon: FolderCog },
      { href: "/platform/customization/form-layouts", label: "Form Layouts", icon: ClipboardList },
      { href: "/platform/customization/field-rules", label: "Field Rules", icon: SlidersHorizontal },
      { href: "/platform/customization/validation-rules", label: "Validation Rules", icon: ShieldCheck },
      { href: "/platform/customization/automation-rules", label: "Automation Rules", icon: Activity },
      { href: "/platform/customization/print-templates", label: "Print Templates", icon: FileText },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/settings/account", label: "Account", icon: UserRound },
      { href: "/org/select", label: "Org Switcher", icon: Building2 },
      { href: "/org/settings", label: "Org IAM", icon: ShieldCheck },
      { href: "/admin", label: "Platform Admin", icon: ShieldCheck },
    ],
  },
];

const groupedNavItems = navGroups.flatMap((group) => group.items);

export const flatNavItems: NavItem[] = Array.from(
  [primaryNavItem, ...groupedNavItems].reduce((acc, item) => {
    if (!acc.has(item.href)) {
      acc.set(item.href, item);
    }
    return acc;
  }, new Map<string, NavItem>()),
).map(([, item]) => item);
