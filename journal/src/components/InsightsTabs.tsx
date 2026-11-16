"use client";

import { useState } from "react";
import type { Entry, Project, Ref } from "@/lib/schema";
import { todayLocal } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { Bottlenecks } from "./Bottlenecks";
import { PatternsView } from "./InsightsView";
import { PageHeader } from "./ui";

export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-[calc(var(--radius)*0.7)] border border-line bg-surface-2/70 p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`rounded-[calc(var(--radius)*0.5)] px-3 py-1.5 text-sm transition ${value === v ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-3 hover:text-ink"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function InsightsTabs({ entries, people, projects }: { entries: Entry[]; people: Ref[]; projects: Project[] }) {
  const mounted = useMounted();
  const [tab, setTab] = useState<"flow" | "patterns">("flow");
  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle="Where work is stuck, who to chase, and the patterns in your days."
        actions={<Tabs label="Insights view" value={tab} onChange={setTab} options={[["flow", "Bottlenecks"], ["patterns", "Patterns"]]} />}
      />
      {tab === "flow" ? mounted && <Bottlenecks entries={entries} projects={projects} people={people} today={todayLocal()} /> : <PatternsView entries={entries} people={people} projects={projects} />}
    </div>
  );
}
