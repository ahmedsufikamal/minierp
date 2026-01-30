"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Opportunity, OpportunityStage } from "@prisma/client";
import { updateOpportunityStage } from "@/app/(app)/customers/kanban-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, MoreHorizontal, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const COLUMNS: OpportunityStage[] = [
  "NEW",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
];

const STAGE_LABELS: Record<OpportunityStage, string> = {
  NEW: "New",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

const STAGE_COLORS: Record<OpportunityStage, string> = {
  NEW: "bg-blue-50 border-blue-100 text-blue-700",
  QUALIFICATION: "bg-indigo-50 border-indigo-100 text-indigo-700",
  PROPOSAL: "bg-purple-50 border-purple-100 text-purple-700",
  NEGOTIATION: "bg-orange-50 border-orange-100 text-orange-700",
  WON: "bg-green-50 border-green-100 text-green-700",
  LOST: "bg-red-50 border-red-100 text-red-700",
};

export function KanbanBoard({ 
  initialOpportunities, 
  customerId 
}: { 
  initialOpportunities: Opportunity[], 
  customerId: string 
}) {
  // We only show active stages + Won. Lost deals might be hidden or in a separate view, but for now let's just show columns.
  const [items, setItems] = useState<Opportunity[]>(initialOpportunities);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItem = items.find((item) => item.id === active.id);
    const newStage = over.id as OpportunityStage;

    if (activeItem && activeItem.stage !== newStage) {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) =>
          item.id === activeItem.id ? { ...item, stage: newStage } : item
        )
      );

      // Server update
      try {
        await updateOpportunityStage(activeItem.id, newStage, customerId);
        toast.success(`Deal moved to ${STAGE_LABELS[newStage]}`);
      } catch (error) {
        toast.error("Failed to update deal stage");
        // Revert
        setItems((prev) =>
          prev.map((item) =>
            item.id === activeItem.id ? { ...item, stage: activeItem.stage } : item
          )
        );
      }
    }
  };

  // Filter items by stage
  const getItemsByStage = (stage: OpportunityStage) => 
    items.filter((item) => item.stage === stage);

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((stage) => (
          <KanbanColumn
            key={stage}
            id={stage}
            title={STAGE_LABELS[stage]}
            items={getItemsByStage(stage)}
            colorClass={STAGE_COLORS[stage]}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? (
          <KanbanCard 
             item={items.find((i) => i.id === activeId)!} 
             isOverlay 
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ 
  id, 
  title, 
  items,
  colorClass
}: { 
  id: OpportunityStage; 
  title: string; 
  items: Opportunity[];
  colorClass: string;
}) {
  const { setNodeRef } = useSortable({
    id: id,
    data: {
      type: "Column",
    },
    disabled: true, // We don't drag columns
  });

  const totalValue = items.reduce((sum, item) => sum + item.valueCents, 0);

  return (
    <div ref={setNodeRef} className="flex h-full min-w-[280px] w-[280px] flex-col rounded-xl bg-slate-100/50 border border-slate-200/60 dark:bg-slate-900/50 dark:border-slate-800">
      <div className={cn("p-3 rounded-t-xl border-b flex items-center justify-between", colorClass, "bg-opacity-20 border-opacity-20")}>
        <div className="font-semibold text-sm">{title}</div>
        <Badge variant="secondary" className="bg-white/50 text-xs font-normal">
          {items.length}
        </Badge>
      </div>
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200/50 text-xs text-slate-500 font-medium">
         {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue / 100)}
      </div>

      <div className="flex-1 p-2 space-y-2">
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <KanbanCard key={item.id} item={item} />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="h-24 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCard({ item, isOverlay }: { item: Opportunity; isOverlay?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: "Item",
      item,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-slate-200 shadow-sm relative group bg-white",
        isDragging && "opacity-50",
        isOverlay && "shadow-xl rotate-2 scale-105 cursor-grabbing z-50 ring-2 ring-indigo-500 ring-offset-2"
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="font-medium text-sm leading-tight text-slate-900 line-clamp-2">
            {item.title}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
           <div className="font-semibold text-slate-700">
             {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.valueCents / 100)}
           </div>
           <div className="flex items-center gap-1">
             <Calendar className="h-3 w-3" />
             {format(new Date(item.createdAt), "MMM d")}
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
