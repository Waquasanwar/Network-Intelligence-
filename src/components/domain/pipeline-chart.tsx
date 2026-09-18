"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import type { OpportunityStatus } from "@prisma/client";

export function PipelineChart({ data }: { data: { stage: string; count: number }[] }) {
  const rows = data.map((d) => ({ name: OPPORTUNITY_STATUS_LABELS[d.stage as OpportunityStatus], count: d.count }));
  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap={18}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-ink-faint)" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-ink-faint)" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--color-surface-muted)" }} contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink)" }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {rows.map((r, i) => <Cell key={i} fill={i >= 4 ? "var(--color-chart-b)" : "var(--color-chart-a)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
