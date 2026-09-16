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
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8b91a0" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8b91a0" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "#f1efeb" }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e6e3dd" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {rows.map((r, i) => <Cell key={i} fill={i >= 4 ? "#0f766e" : "#14213d"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
