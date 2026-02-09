"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { nav } from "@/config/nav";

const quickActions = [
  { label: "New customer", href: "/customers", keywords: ["add", "create"] },
  { label: "New invoice", href: "/invoices", keywords: ["add", "create"] },
  { label: "New product", href: "/products", keywords: ["add", "create"] },
  { label: "New vendor", href: "/vendors", keywords: ["add", "create"] },
  { label: "New quote", href: "/quotes", keywords: ["add", "create"] },
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
      <DialogContent className="overflow-hidden p-0 gap-0 border-border bg-background">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="rounded-lg">
          <CommandInput placeholder="Search pages or actions…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Go to">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
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
                  key={a.href + a.label}
                  value={`${a.label} ${a.href} ${a.keywords.join(" ")}`}
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
