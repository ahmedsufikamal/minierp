"use client";

import Link from "next/link";
import {
  ChevronDown,
  LayoutList,
  MoreHorizontal,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ListToolbarSavedFilterItem = {
  id: string;
  name: string;
};

interface ListToolbarProps {
  savedFilters?: ListToolbarSavedFilterItem[];
  onRefresh?: () => void;
  onSaveCurrentFilter?: () => void;
  onApplySavedFilter?: (presetId: string) => void;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  showViewSwitcher?: boolean;
  showSavedFilters?: boolean;
  showRefresh?: boolean;
  showMoreMenu?: boolean;
  savedFiltersEnabled?: boolean;
}

export function ListToolbar({
  savedFilters = [],
  onRefresh,
  onSaveCurrentFilter,
  onApplySavedFilter,
  primaryActionLabel,
  primaryActionHref,
  showViewSwitcher = true,
  showSavedFilters = true,
  showRefresh = true,
  showMoreMenu = true,
  savedFiltersEnabled,
}: ListToolbarProps) {
  const shouldShowSavedFilters = savedFiltersEnabled ?? showSavedFilters;
  const secondaryButtonClassName =
    "h-10 rounded-xl border-transparent bg-[hsl(var(--surface-2))] px-4 text-[14px] font-medium shadow-none hover:border-transparent hover:bg-[hsl(var(--surface-interactive))] hover:shadow-none";
  const iconButtonClassName =
    "h-10 w-10 rounded-xl border-transparent bg-[hsl(var(--surface-2))] text-foreground shadow-none hover:border-transparent hover:bg-[hsl(var(--surface-interactive))] hover:shadow-none";
  const primaryButtonClassName =
    "h-10 rounded-xl border-transparent bg-foreground px-5 text-[14px] font-medium text-background shadow-none hover:bg-foreground/90 hover:shadow-none";

  return (
    <>
      {showViewSwitcher ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className={secondaryButtonClassName}>
              <LayoutList className="mr-2 h-4 w-4" />
              List View
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-56 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated pointer-events-auto"
          >
            <DropdownMenuItem disabled>Report View</DropdownMenuItem>
            <DropdownMenuItem disabled>Dashboard View</DropdownMenuItem>
            <DropdownMenuItem disabled>Kanban View</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {shouldShowSavedFilters ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className={secondaryButtonClassName}>
              Saved Filters
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated pointer-events-auto"
          >
            <DropdownMenuItem disabled={!onSaveCurrentFilter} onSelect={() => onSaveCurrentFilter?.()}>
              Save Current Filter
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {savedFilters.length === 0 ? (
              <DropdownMenuItem disabled>No saved filters yet</DropdownMenuItem>
            ) : (
              savedFilters.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  disabled={!onApplySavedFilter}
                  onSelect={() => onApplySavedFilter?.(preset.id)}
                >
                  {preset.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {showRefresh ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={iconButtonClassName}
          onClick={onRefresh}
          aria-label="Refresh"
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
      ) : null}

      {showMoreMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={iconButtonClassName}
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated pointer-events-auto"
          >
            <DropdownMenuItem>Import</DropdownMenuItem>
            <DropdownMenuItem>User Permissions</DropdownMenuItem>
            <DropdownMenuItem>Role Permissions Manager</DropdownMenuItem>
            <DropdownMenuItem className="flex items-center justify-between">
              <span>Customize</span>
              <span className="text-xs text-muted-foreground">⌘+Y</span>
            </DropdownMenuItem>
            <DropdownMenuItem>Customize Quick Filters</DropdownMenuItem>
            <DropdownMenuItem>List Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {primaryActionLabel && primaryActionHref ? (
        <Button asChild size="sm" className={primaryButtonClassName}>
          <Link href={primaryActionHref}>
            <Plus className="mr-2 h-4 w-4" />
            {primaryActionLabel}
          </Link>
        </Button>
      ) : null}
    </>
  );
}
