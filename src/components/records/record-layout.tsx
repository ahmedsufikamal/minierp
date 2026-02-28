"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type RecordTab = {
  value: string;
  label: string;
};

interface RecordLayoutProps {
  tabs: RecordTab[];
  activeTab: string;
  onTabChange: (value: string) => void;
  main: React.ReactNode;
  inspector: React.ReactNode;
}

export function RecordLayout({ tabs, activeTab, onTabChange, main, inspector }: RecordLayoutProps) {
  return (
    <div className="space-y-5">
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="rounded-xl px-4 py-2">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),320px]">
        <div className="min-w-0">{main}</div>
        <aside className="min-w-0">{inspector}</aside>
      </div>
    </div>
  );
}
