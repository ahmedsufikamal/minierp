"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { nav } from "@/config/nav";

type CommandAction = {
  id: string;
  label: string;
  href: string;
  keywords: string[];
};

const quickActions: CommandAction[] = [
  {
    id: "customer.create",
    label: "New customer",
    href: "/selling/customers",
    keywords: ["add", "create", "selling"],
  },
  {
    id: "quotation.create",
    label: "New quotation",
    href: "/selling/quotations",
    keywords: ["add", "create", "selling"],
  },
  {
    id: "sales-order.create",
    label: "New sales order",
    href: "/selling/sales-orders",
    keywords: ["add", "create", "selling"],
  },
  {
    id: "supplier.create",
    label: "New supplier",
    href: "/buying/suppliers",
    keywords: ["add", "create", "buying"],
  },
  {
    id: "material-request.create",
    label: "New material request",
    href: "/buying/material-requests",
    keywords: ["add", "create", "buying"],
  },
  {
    id: "work-order.create",
    label: "New work order",
    href: "/manufacturing/work-orders",
    keywords: ["add", "create", "manufacturing"],
  },
  {
    id: "support-ticket.open",
    label: "Open support ticket",
    href: "/support/tickets",
    keywords: ["add", "create", "support"],
  },
  {
    id: "ops-inbox.open",
    label: "Open Ops Inbox",
    href: "/ops/inbox",
    keywords: ["ops", "inbox", "priority", "exceptions"],
  },
  {
    id: "ops-recommendations.review",
    label: "Review Action Recommendations",
    href: "/ops/recommendations",
    keywords: ["ops", "ai", "recommendations", "next-best-action"],
  },
];

type CommandPaletteContextType = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};
const CommandPaletteContext = createContext<CommandPaletteContextType | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  return ctx ?? { open: false, setOpen: () => {} };
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  function run(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command>
          <CommandInput placeholder="Search pages or actions…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Go to">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={`${item.label}-${item.href}`}
                    value={`${item.label} ${item.href}`}
                    onSelect={() => run(item.href)}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandGroup heading="Quick actions">
              {quickActions.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.id} ${a.label} ${a.href} ${a.keywords.join(" ")}`}
                  onSelect={() => run(a.href)}
                >
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
