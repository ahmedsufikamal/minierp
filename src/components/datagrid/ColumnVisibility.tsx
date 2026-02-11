"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type VisibilityColumn = { key: string; label: string; visible: boolean };

interface ColumnVisibilityProps {
  columns: VisibilityColumn[];
  onToggle: (key: string) => void;
}

export function ColumnVisibility({ columns, onToggle }: ColumnVisibilityProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Settings2 className="mr-1 h-4 w-4" /> Columns</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map((column) => (
          <DropdownMenuCheckboxItem key={column.key} checked={column.visible} onCheckedChange={() => onToggle(column.key)}>
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
