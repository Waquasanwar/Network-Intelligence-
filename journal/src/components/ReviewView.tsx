"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { archiveAction, updateAction } from "@/app/actions";
import {
  CATEGORIES, ENERGIES, ENTRY_TYPES, LEVELS, SENTIMENTS, SOURCES, STATUSES, PRIORITIES, DIRECTIONS,
  type Entry, type EntryInput, type Ref,
} from "@/lib/schema";
import { enrich } from "@/lib/parse";
import { time, shortDate } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { Field, NamesField, Segmented, SelectField, splitNames } from "./fields";
import { Empty, PageHeader, TypeBadge } from "./ui";

const names = (ids: string[], refs: Ref[]) => ids.map((id) => refs.find((r) => r.id === id)?.name).filter(Boolean).join(", ");

function EnrichCard({ entry, people, projects, tags }: { entry: Entry; people: Ref[]; projects: Ref[]; tags: string[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // Suggestions from the wording fill any gaps, so review is mostly confirming.
  const guess = enrich(entry.title);
  const [f, setF] = useState<EntryInput & { tagText: string; peopleText: string; projectText: string }>({
    title: entry.title,
    type: entry.type ?? guess.type ?? "Note",
    status: entry.status === "Inbox" ? (entry.type === "Request" || entry.type === "Question" || entry.type === "Blocker / Risk" ? "Open" : "Done") : entry.status,
    category: entry.category ?? guess.category ?? null,
    source: entry.source ?? guess.source ?? null,
    sentiment: entry.sentiment ?? guess.sentiment ?? null,
    energy: entry.energy ?? null,
    impact: entry.impact ?? null,
    priority: entry.priority ?? null,
    direction: entry.direction ?? null,
    due: entry.due ?? null,
    rationale: entry.rationale ?? "",
    alternatives: entry.alternatives ?? "",
    tagText: [...new Set([...entry.tags, ...guess.tags])].join(", "),
    peopleText: names(entry.peopleIds, people),
    projectText: names(entry.projectIds, projects),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function save() {
    setError("");
    const { tagText, peopleText, projectText, ...rest } = f;
    start(async () => {
      const res = await updateAction(entry.id, {
        ...rest,
        rationale: f.type === "Decision" ? f.rationale : undefined,
        alternatives: f.type === "Decision" ? f.alternatives : undefined,
        direction: f.type === "Request" ? f.direction : undefined,
        tags: splitNames(tagText).map((t) => t.toLowerCase()),
        people: splitNames(peopleText),
        projects: splitNames(projectText),
        reviewed: true,
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  function archive() {
    start(async () => {
      const res = await archiveAction(entry.id);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  if (done) return null;

  return (
    <article className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs text-ink-3">
        <TypeBadge type={entry.type} />
        <span suppressHydrationWarning>{mounted ? `${shortDate(entry.captured.slice(0, 10))} · ${time(entry.captured)}` : ""}</span>
        <Link href={`/entry/${entry.id}`} className="ml-auto hover:text-accent">
          Open full entry →
        </Link>
      </div>
      <input className="field mb-3 text-[0.95rem] font-medium" value={f.title} onChange={(e) => set("title", e.target.value)} aria-label="Title" />

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label="Type" options={ENTRY_TYPES} value={f.type} onChange={(v) => set("type", v ?? "Note")} />
        <SelectField label="Status" options={STATUSES} value={f.status} onChange={(v) => set("status", v ?? "Inbox")} />
        <SelectField label="Category" options={CATEGORIES} value={f.category} onChange={(v) => set("category", v)} />
        <p className="-mb-1 text-[0.7rem] text-ink-3 sm:col-span-3">Tags, people and projects are comma separated. New names are added to Notion for you.</p>
        <NamesField label="Tags" value={f.tagText} onChange={(v) => set("tagText", v)} suggestions={tags} placeholder="budget, client" />
        <NamesField label="People" value={f.peopleText} onChange={(v) => set("peopleText", v)} suggestions={people.map((p) => p.name)} />
        <NamesField label="Projects" value={f.projectText} onChange={(v) => set("projectText", v)} suggestions={projects.map((p) => p.name)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
        <Segmented label="Sentiment" options={SENTIMENTS} value={f.sentiment} onChange={(v) => set("sentiment", v)} />
        <Segmented label="Energy" options={ENERGIES} value={f.energy} onChange={(v) => set("energy", v)} />
        <Segmented label="Impact" options={LEVELS} value={f.impact} onChange={(v) => set("impact", v)} />
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">More fields</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <SelectField label="Source" options={SOURCES} value={f.source} onChange={(v) => set("source", v)} />
          <SelectField label="Priority" options={PRIORITIES} value={f.priority} onChange={(v) => set("priority", v)} />
          <Field label="Due">
            <input type="date" className="field" value={f.due ?? ""} onChange={(e) => set("due", e.target.value || null)} />
          </Field>
          {f.type === "Request" && <SelectField label="Direction" options={DIRECTIONS} value={f.direction} onChange={(v) => set("direction", v)} />}
        </div>
      </details>

      {f.type === "Decision" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Why (rationale)">
            <textarea className="field" rows={2} value={f.rationale} onChange={(e) => set("rationale", e.target.value)} />
          </Field>
          <Field label="Alternatives considered">
            <textarea className="field" rows={2} value={f.alternatives} onChange={(e) => set("alternatives", e.target.value)} />
          </Field>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "✓ Save & mark reviewed"}
        </button>
        <button className="btn ml-auto text-ink-3" onClick={archive} disabled={pending} title="Move to Notion trash">
          Delete
        </button>
      </div>
    </article>
  );
}

export function ReviewView({ entries, people, projects }: { entries: Entry[]; people: Ref[]; projects: Ref[] }) {
  const inbox = entries.filter((e) => !e.reviewed).sort((a, b) => a.captured.localeCompare(b.captured));
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  return (
    <div>
      <PageHeader
        title="Review"
        subtitle={inbox.length ? `${inbox.length} to enrich. Guesses from your wording are pre-filled; confirm or change them.` : "All caught up."}
      />
      {inbox.length ? (
        <div className="space-y-4">
          {inbox.map((e) => (
            <EnrichCard key={e.id} entry={e} people={people} projects={projects} tags={tags} />
          ))}
        </div>
      ) : (
        <Empty>Inbox zero. Everything you captured is tagged and filed.</Empty>
      )}
    </div>
  );
}
