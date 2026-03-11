"use client";

import Link from "next/link";
import { Menu, Plus, Search, Upload } from "lucide-react";
import { CompanyBrandAsset } from "@/components/company-brand-asset";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCommandPalette } from "@/components/command-palette";
import {
  resolveCompanyBrandingFallback,
  type ActiveCompanyBranding,
} from "@/modules/iam/application/company-branding";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onOpenMobile: () => void;
  branding?: ActiveCompanyBranding | null;
}

export function Topbar({ onOpenMobile, branding }: TopbarProps) {
  const mounted = useMounted();
  const { setOpen: setCommandOpen } = useCommandPalette();
  const companyFallback = resolveCompanyBrandingFallback(branding?.companyName);
  const createTrigger = (
    <Button size="sm" type="button">
      <Plus className="mr-1 h-4 w-4" /> Create
    </Button>
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-[hsl(var(--surface-1))/0.94] px-3 backdrop-blur md:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMobile} aria-label="Open sidebar">
        <Menu className="h-4 w-4" />
      </Button>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className={cn(
          buttonVariants({ variant: "utility", size: "sm" }),
          "h-9 w-full max-w-xl justify-start gap-2 bg-[hsl(var(--surface-2))] px-3 text-left font-normal text-muted-foreground",
        )}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Search modules, records, and actions...</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 text-[10px] md:inline">
          Cmd+K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{createTrigger}</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/selling/sales-orders">New sales order</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/selling/quotations">New quotation</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/buying/material-requests">New material request</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/manufacturing/work-orders">New work order</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          createTrigger
        )}
        <Link
          href="/org/settings"
          className={cn(
            "group flex shrink-0 items-center rounded-2xl border border-[hsl(var(--border)/0.9)]",
            "bg-[hsl(var(--surface-2))] px-2 py-1.5 shadow-sm transition-colors hover:border-[hsl(var(--ring)/0.45)]",
            "hover:bg-[hsl(var(--surface-interactive))]",
          )}
          aria-label={`Open organization settings for ${companyFallback.label}`}
        >
          <CompanyBrandAsset
            branding={branding}
            className="h-10 w-[86px] border-0 bg-transparent px-0 py-0 shadow-none sm:w-[104px] lg:w-[128px]"
            fallbackClassName="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface-1))]"
            dataTestId="topbar-company-brand"
          />
        </Link>
      </div>
    </header>
  );
}
