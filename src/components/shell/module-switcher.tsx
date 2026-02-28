"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { MiniERPLogo } from "@/components/minierp-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ShellModule } from "./shell-config";

interface ModuleSwitcherProps {
  activeModule: ShellModule;
  modules: ShellModule[];
  collapsed: boolean;
  subtext: string;
}

export function ModuleSwitcher({ activeModule, modules, collapsed, subtext }: ModuleSwitcherProps) {
  const [previewModuleId, setPreviewModuleId] = useState(activeModule.id);

  useEffect(() => {
    setPreviewModuleId(activeModule.id);
  }, [activeModule.id]);

  const previewModule = useMemo(
    () => modules.find((module) => module.id === previewModuleId) ?? activeModule,
    [activeModule, modules, previewModuleId],
  );

  const ActiveIcon = activeModule.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto w-full items-start justify-start rounded-2xl border border-border/80 bg-[hsl(var(--surface-2))] px-3 py-3 text-left hover:bg-[hsl(var(--surface-3))]",
            collapsed && "justify-center px-2.5",
          )}
          title={collapsed ? `${activeModule.label} module` : undefined}
          aria-label="Switch module"
        >
          {collapsed ? (
            <ActiveIcon className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-[hsl(var(--surface-1))] text-foreground">
                <MiniERPLogo size="icon" showWordmark={false} className="scale-[0.48]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{activeModule.label}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="truncate text-xs text-muted-foreground">{subtext}</p>
              </div>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[min(92vw,760px)] rounded-2xl border border-border bg-popover p-0 text-popover-foreground"
        align="start"
        sideOffset={10}
      >
        <div className="grid gap-0 md:grid-cols-[220px,1fr]">
          <div className="border-b border-border bg-[hsl(var(--surface-2))] p-2 md:border-b-0 md:border-r">
            <p className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Modules
            </p>
            <div className="space-y-1">
              {modules.map((module) => {
                const Icon = module.icon;
                const selected = module.id === previewModule.id;
                return (
                  <button
                    key={module.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                      "text-muted-foreground hover:bg-[hsl(var(--surface-3))] hover:text-foreground",
                      selected && "bg-[hsl(var(--surface-3))] text-foreground",
                    )}
                    onPointerEnter={() => setPreviewModuleId(module.id)}
                    onFocus={() => setPreviewModuleId(module.id)}
                    onClick={() => setPreviewModuleId(module.id)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{module.label}</span>
                    {module.id === activeModule.id ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-4">
            <div className="mb-4 space-y-1">
              <p className="text-sm font-semibold text-foreground">{previewModule.label}</p>
              <p className="text-sm text-muted-foreground">{previewModule.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {previewModule.sections.map((section) => (
                <div key={`${previewModule.id}-${section.title}`} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {section.title}
                  </p>
                  <div className="space-y-1.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={`${previewModule.id}-${section.title}-${item.label}-${item.href}`}
                          href={item.href}
                          className="flex items-start gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[hsl(var(--surface-2))]"
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">{item.label}</span>
                            {item.description ? (
                              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                            ) : null}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
