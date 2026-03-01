import { Monitor, MoreHorizontal } from "lucide-react";
import { WorkbenchTopBar } from "@/components/listing/WorkbenchTopBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { StockWorkspaceClient } from "./_components/workspace-client";

export const dynamic = "force-dynamic";

export default async function StockWorkspacePage() {
  await getInventoryPageContext(inventoryPermissions.itemRead);

  return (
    <div className="space-y-5">
      <WorkbenchTopBar
        breadcrumbs={
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-muted-foreground sm:text-[15px]"
          >
            <Monitor className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Dashboard</span>
            <span className="shrink-0 text-muted-foreground/70">/</span>
            <span className="truncate font-semibold text-foreground" aria-current="page">
              Stock
            </span>
          </nav>
        }
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-xl border-transparent bg-[hsl(var(--surface-2))] shadow-none hover:border-transparent hover:bg-[hsl(var(--surface-interactive))] hover:shadow-none"
                aria-label="More workspace actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-52 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated pointer-events-auto"
            >
              <DropdownMenuItem>Stock Settings</DropdownMenuItem>
              <DropdownMenuItem>Refresh Workspace</DropdownMenuItem>
              <DropdownMenuItem>Open Reports</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <StockWorkspaceClient />
    </div>
  );
}
