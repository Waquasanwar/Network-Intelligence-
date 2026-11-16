"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { appendNoteAction, archiveAction, updateAction } from "@/app/actions";
import {
  CATEGORIES, DIRECTIONS, ENERGIES, ENTRY_TYPES, LEVELS, PRIORITIES, SENTIMENTS, SOURCES, STATUSES,
  loggedAt, type Entry, type EntryInput, type Ref,
} from "@/lib/schema";
import { time } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { Field, NamesField, Segmented, SelectField, splitNames } from "./fields";
import { TypeBadge } from "./ui";

const names = (ids: string[], refs: Ref[]) => ids.map((id) => refs.find((r) => r.id === id)?.name).filter(Boolean).join(", ");

export function EntryEditor({ entry, body, people, projects, tags, mode }: { entry: Entry; body: string; people: Ref[]; projects: Ref[]; tags: string[]; mode: "notion" | "demo" }) {
  const router = useRouter();
  const mounted = useMounted();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [note, setNote] = useState("");
  const [f, setF] = useState({
    title: entry.title,
    type: entry.type ?? "Note",
    status: entry.status ?? "Inbox",
    category: entry.category ?? null,
    source: entry.source ?? null,
    direction: entry.direction ?? null,
    priority: entry.priority ?? null,
    impact: entry.impact ?? null,
    sentiment: entry.sentiment ?? null,
    energy: entry.energy ?? null,
    due: entry.due?.slice(0, 10) ?? "",
    followUp: entry.followUp?.slice(0, 10) ?? "",
    backdate: entry.backdate?.slice(0, 10) ?? "",
    rationale: entry.rationale ?? "",
    alternatives: entry.alternatives ?? "",
    outcome: entry.outcome ?? "",
    link: entry.link ?? "",
    reviewed: entry.reviewed,
    tagText: entry.tags.join(", "),
    peopleText: names(entry.peopleIds, people),
    projectText: names(entry.projectIds, projects),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function save() {
    setMsg(null);
    const input: EntryInput = {
      title: f.title,
      type: f.type,
      status: f.status,
      category: f.category,
      source: f.source,
      direction: f.direction,
      priority: f.priority,
      impact: f.impact,
      sentiment: f.sentiment,
      energy: f.energy,
      due: f.due || null,
      followUp: f.followUp || null,
      backdate: f.backdate || null,
      rationale: f.rationale,
      alternatives: f.alternatives,
      outcome: f.outcome,
      link: f.link || null,
      reviewed: f.reviewed,
      tags: splitNames(f.tagText).map((t) => t.toLowerCase()),
      people: splitNames(f.peopleText),
      projects: splitNames(f.projectText),
    };
    start(async () => {
      const res = await updateAction(entry.id, input);
      setMsg(res.ok ? { tone: "ok", text: "Saved" } : { tone: "danger", text: res.error });
      if (res.ok) router.refresh();
    });
  }

  function addNote() {
    start(async () => {
      const res = await appendNoteAction(entry.id, note);
      if (res.ok) {
        setNote("");
        router.refresh();
      } else setMsg({ tone: "danger", text: res.error });
    });
  }

  function remove() {
    if (!confirm("Move this entry to the Notion trash?")) return;
    start(async () => {
      const res = await archiveAction(entry.id);
      if (res.ok) router.push("/timeline");
      else setMsg({ tone: "danger", text: res.error });
    });
  }

  const when = loggedAt(entry);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <Link href="/timeline" className="hover:text-ink">← Timeline</Link>
        <span>·</span>
        <TypeBadge type={entry.type} />
        {entry.number && <span>JRNL-{entry.number}</span>}
        <span suppressHydrationWarning>
          {mounted ? `${new Date(/^\d{4}-\d{2}-\d{2}$/.test(when) ? `${when}T12:00:00` : when).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} ${time(when)}` : ""}
        </span>
        {mode === "notion" && (
          <a href={entry.url} target="_blank" rel="noreferrer" className="ml-auto hover:text-accent">
            Open in Notion ↗
          </a>
        )}
      </div>

      <div className="card space-y-4 p-4">
        <textarea className="field text-base font-medium" rows={2} value={f.title} onChange={(e) => set("title", e.target.value)} aria-label="Title" />
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Type" options={ENTRY_TYPES} value={f.type} onChange={(v) => set("type", v ?? "Note")} />
          <SelectField label="Status" options={STATUSES} value={f.status} onChange={(v) => set("status", v ?? "Inbox")} />
          <SelectField label="Category" options={CATEGORIES} value={f.category} onChange={(v) => set("category", v)} />
          <p className="-mb-1 text-[0.7rem] text-ink-3 sm:col-span-3">Tags, people and projects are comma separated. New names are added to Notion for you.</p>
          <NamesField label="Tags" value={f.tagText} onChange={(v) => set("tagText", v)} suggestions={tags} />
          <NamesField label="People" value={f.peopleText} onChange={(v) => set("peopleText", v)} suggestions={people.map((p) => p.name)} />
          <NamesField label="Projects" value={f.projectText} onChange={(v) => set("projectText", v)} suggestions={projects.map((p) => p.name)} />
          <SelectField label="Source" options={SOURCES} value={f.source} onChange={(v) => set("source", v)} />
          <SelectField label="Priority" options={PRIORITIES} value={f.priority} onChange={(v) => set("priority", v)} />
          <SelectField label="Direction" options={DIRECTIONS} value={f.direction} onChange={(v) => set("direction", v)} />
          <Field label="Due">
            <input type="date" className="field" value={f.due} onChange={(e) => set("due", e.target.value)} />
          </Field>
          <Field label="Follow up on">
            <input type="date" className="field" value={f.followUp} onChange={(e) => set("followUp", e.target.value)} />
          </Field>
          <Field label="Backdate" hint="Only if it happened on an earlier day">
            <input type="date" className="field" value={f.backdate} onChange={(e) => set("backdate", e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          <Segmented label="Sentiment" options={SENTIMENTS} value={f.sentiment} onChange={(v) => set("sentiment", v)} />
          <Segmented label="Energy" options={ENERGIES} value={f.energy} onChange={(v) => set("energy", v)} />
          <Segmented label="Impact" options={LEVELS} value={f.impact} onChange={(v) => set("impact", v)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Rationale (why)">
            <textarea className="field" rows={3} value={f.rationale} onChange={(e) => set("rationale", e.target.value)} />
          </Field>
          <Field label="Alternatives considered">
            <textarea className="field" rows={3} value={f.alternatives} onChange={(e) => set("alternatives", e.target.value)} />
          </Field>
          <Field label="Outcome (fill in later)">
            <textarea className="field" rows={3} value={f.outcome} onChange={(e) => set("outcome", e.target.value)} />
          </Field>
        </div>
        <Field label="Link">
          <input type="url" className="field" placeholder="https://" value={f.link} onChange={(e) => set("link", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.reviewed} onChange={(e) => set("reviewed", e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Reviewed
        </label>
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <button className="btn btn-primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          {msg && <span role="status" className={`text-sm ${msg.tone === "ok" ? "text-ok" : "text-danger"}`}>{msg.text}</span>}
          <button className="btn ml-auto text-danger" onClick={remove} disabled={pending}>
            Delete
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold">Notes</h2>
        {body ? (
          <div className="mt-2 space-y-1 text-sm whitespace-pre-wrap text-ink-2">{body}</div>
        ) : (
          <p className="mt-1 text-xs text-ink-3">No notes yet. Add context, follow-ups or what happened next.</p>
        )}
        <div className="mt-3 flex gap-2">
          <textarea className="field" rows={2} placeholder="Add a note… (lines starting with - become bullets)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn self-end" onClick={addNote} disabled={pending || !note.trim()}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
