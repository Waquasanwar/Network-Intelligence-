"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORIES, ENTRY_TYPES, TYPE_STYLE, isClosed, isOverdue, loggedAt, type Entry, type EntryType, type Ref } from "@/lib/schema";
import { localDate } from "@/lib/insights";
import { dayLabel, todayLocal } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { EntryCard } from "./EntryCard";
import { Empty, PageHeader } from "./ui";

type Special = "" | "open" | "overdue" | "unreviewed";

function toCsv(entries: Entry[], people: Ref[], projects: Ref[]) {
  const name = (refs: Ref[], ids: string[]) => ids.map((id) => refs.find((r) => r.id === id)?.name ?? "").join("; ");
  const cols: Array<[string, (e: Entry) => string | number | undefined]> = [
    ["ID", (e) => e.number],
    ["Logged at", (e) => loggedAt(e)],
    ["Type", (e) => e.type],
    ["Entry", (e) => e.title],
    ["Status", (e) => e.status],
    ["Category", (e) => e.category],
    ["Tags", (e) => e.tags.join("; ")],
    ["Projects", (e) => name(projects, e.projectIds)],
    ["People", (e) => name(people, e.peopleIds)],
    ["Source", (e) => e.source],
    ["Direction", (e) => e.direction],
    ["Priority", (e) => e.priority],
    ["Impact", (e) => e.impact],
    ["Sentiment", (e) => e.sentiment],
    ["Energy", (e) => e.energy],
    ["Due", (e) => e.due],
    ["Follow-up on", (e) => e.followUp],
    ["Rationale", (e) => e.rationale],
    ["Alternatives", (e) => e.alternatives],
    ["Outcome", (e) => e.outcome],
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(([h]) => h).join(","), ...entries.map((e) => cols.map(([, f]) => esc(f(e))).join(","))].join("\n");
}

export function TimelineView({ entries, people, projects }: { entries: Entry[]; people: Ref[]; projects: Ref[] }) {
  const params = useSearchParams();
  const mounted = useMounted();
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<EntryType[]>([]);
  const [tag, setTag] = useState(params.get("tag") ?? "");
  const [project, setProject] = useState(params.get("project") ?? "");
  const [person, setPerson] = useState(params.get("person") ?? "");
  const [category, setCategory] = useState("");
  const [special, setSpecial] = useState<Special>((params.get("filter") as Special) ?? "");

  const tags = useMemo(() => [...new Set(entries.flatMap((e) => e.tags))].sort(), [entries]);
  const today = todayLocal();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => !types.length || (e.type && types.includes(e.type)))
      .filter((e) => !tag || e.tags.includes(tag))
      .filter((e) => !project || e.projectIds.includes(project))
      .filter((e) => !person || e.peopleIds.includes(person))
      .filter((e) => !category || e.category === category)
      .filter((e) =>
        special === "open" ? !isClosed(e) && e.type !== "Note" : special === "overdue" ? isOverdue(e, today) : special === "unreviewed" ? !e.reviewed : true,
      )
      .filter((e) => {
        if (!needle) return true;
        const hay = [e.title, e.rationale, e.alternatives, e.outcome, e.tags.join(" "), ...e.peopleIds.map((id) => people.find((p) => p.id === id)?.name)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => loggedAt(b).localeCompare(loggedAt(a)));
  }, [entries, q, types, tag, project, person, category, special, today, people]);

  const groups = useMemo(() => {
    if (!mounted) return [];
    const m = new Map<string, Entry[]>();
    for (const e of filtered) {
      const d = localDate(loggedAt(e));
      m.set(d, [...(m.get(d) ?? []), e]);
    }
    return [...m.entries()];
  }, [filtered, mounted]);

  function exportCsv() {
    const blob = new Blob([toCsv(filtered, people, projects)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `journal-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const active = types.length || tag || project || person || category || special || q;

  return (
    <div>
      <PageHeader
        title="Timeline"
        subtitle={`${filtered.length} of ${entries.length} entries, newest first`}
        actions={
          <button className="btn" onClick={exportCsv}>
            ⬇ Export CSV
          </button>
        }
      />

      <div className="card mb-5 space-y-3 p-3">
        <input className="field" type="search" placeholder="Search titles, rationale, outcomes, people…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
          {ENTRY_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                aria-pressed={on}
                onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])}
                className={`rounded-md px-2 py-1 text-xs ${on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
              >
                {TYPE_STYLE[t].emoji} {t}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select className="field" value={special} onChange={(e) => setSpecial(e.target.value as Special)} aria-label="Status">
            <option value="">Any status</option>
            <option value="open">Open loops</option>
            <option value="overdue">Overdue</option>
            <option value="unreviewed">Not reviewed</option>
          </select>
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">Any category</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="field" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
          <select className="field" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
            <option value="">Any project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="field" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {active ? (
          <button
            className="text-xs text-accent hover:underline"
            onClick={() => {
              setQ("");
              setTypes([]);
              setTag("");
              setProject("");
              setPerson("");
              setCategory("");
              setSpecial("");
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {mounted && !groups.length && <Empty>No entries match these filters.</Empty>}
      <div className="space-y-5">
        {groups.map(([day, list]) => (
          <section key={day}>
            <h2 className="sticky top-0 z-10 -mx-1 mb-1.5 bg-bg/95 px-1 py-1 text-sm font-semibold text-ink-2 backdrop-blur">
              {dayLabel(day, today)} <span className="font-normal text-ink-3">· {list.length}</span>
            </h2>
            <div className="card divide-y divide-line py-1">
              {list.map((e) => (
                <EntryCard key={e.id} entry={e} people={people} projects={projects} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
