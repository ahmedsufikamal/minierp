"use client";

import { useState } from "react";
import { ChevronRight, Command as CommandIcon, MousePointerClick } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function FloatingLayersShowcase() {
  const [menuActionCount, setMenuActionCount] = useState(0);
  const [backgroundClickCount, setBackgroundClickCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogActionCount, setDialogActionCount] = useState(0);
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Dev Verification
        </p>
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Floating Layer Showcase</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Use this page to verify dropdowns, dialogs, and the command palette remain opaque,
            clickable, and layered above the application shell.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
        <section className="surface-1 space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Interactive Layers</h2>
            <p className="text-sm text-muted-foreground">
              The background target sits directly under the dropdown panel so click-through bugs are
              obvious.
            </p>
          </div>

          <div className="relative min-h-[18rem] rounded-2xl border border-dashed border-border bg-[hsl(var(--surface-2))] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-testid="floating-dropdown-trigger">Open dropdown</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8} className="w-56">
                  <DropdownMenuLabel>Floating actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="floating-dropdown-item"
                    onSelect={() => setMenuActionCount((count) => count + 1)}
                  >
                    Primary menu action
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>More actions</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      <DropdownMenuItem onSelect={() => setMenuActionCount((count) => count + 1)}>
                        Nested action
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                onClick={() => setDialogOpen(true)}
                data-testid="floating-dialog-trigger"
              >
                Open dialog
              </Button>

              <Button
                variant="secondary"
                onClick={() => setCommandPaletteOpen(true)}
                data-testid="floating-command-trigger"
              >
                <CommandIcon className="mr-2 h-4 w-4" />
                Open command palette
              </Button>
            </div>

            <button
              type="button"
              data-testid="background-target"
              onClick={() => setBackgroundClickCount((count) => count + 1)}
              className="absolute left-4 top-[4.5rem] flex h-11 w-56 items-center justify-center rounded-xl border border-border bg-[hsl(var(--surface-1))] text-sm font-medium text-foreground"
            >
              Background target
            </button>

            <div className="absolute bottom-4 right-4 grid gap-2 text-xs text-muted-foreground sm:text-sm">
              <div className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4" />
                <span data-testid="menu-action-count">Menu actions: {menuActionCount}</span>
              </div>
              <div>
                <span data-testid="background-click-count">
                  Background clicks: {backgroundClickCount}
                </span>
              </div>
              <div>
                <span data-testid="dialog-action-count">Dialog actions: {dialogActionCount}</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="surface-1 space-y-4 p-6">
          <h2 className="text-lg font-semibold text-foreground">Checks</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              Dropdown content should cover the background target without passing clicks through.
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              Dialog content should sit above the overlay and remain clickable.
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              Command palette should inherit the same opaque popover surface as other floating
              layers.
            </li>
          </ul>
        </aside>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="floating-dialog-content">
          <DialogHeader>
            <DialogTitle>Dialog verification</DialogTitle>
            <DialogDescription>
              This dialog should render above the overlay and accept clicks normally.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              data-testid="floating-dialog-action"
              onClick={() => {
                setDialogActionCount((count) => count + 1);
                setDialogOpen(false);
              }}
            >
              Confirm action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
