"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Point = { month: string; label: string; totalCents: number };

export function SalesChart({ data }: { data: Point[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            className="text-slate-600 dark:text-slate-400"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="text-slate-600 dark:text-slate-400"
            tickFormatter={(v) => (v >= 100 ? `${(v / 100).toFixed(0)}` : String(v))}
          />
          <Tooltip
            formatter={(value: number) => [(value / 100).toFixed(2), "Total"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="totalCents" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
