"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction, updateProjectAction } from "@/app/actions";
import { HEALTH, PRIORITIES, isClosed, isProcurement, loggedAt, type Entry, type Health, type Project, type ProjectInput, type Ref } from "@/lib/schema";
import { daysBetween, projectStats } from "@/lib/planning";
import { shortDate, todayLocal } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { CaptureBox } from "./CaptureBox";
import { Tabs } from "./InsightsTabs";
import { Field, SelectField } from "./fields";
import { Bar, ChaseButton, EmptyRow, Kpi, Section, WorkRow, money, moneyShort } from "./work";
import { Chip, PageHeader, TypeDot } from "./ui";

const HEALTH_TONE: Record<string, "ok" | "warn" | "danger" | "plain"> = { "On track": "ok", "At risk": "warn", "Off track": "danger", "Not set": "plain" };
const RANK: Record<string, number> = { "Off track": 0, "At risk": 1, "On track": 2, "Not set": 3 };

export function HealthBadge({ health, suggested }: { health?: Health; suggested: Health }) {
  const set = health && health !== "Not set";
  const h = set ? health : suggested;
  const dot = h === "On track" ? "var(--ok)" : h === "At risk" ? "var(--warn)" : h === "Off track" ? "var(--danger)" : "var(--ink-3)";
  return (
    <Chip tone={set ? HEALTH_TONE[h] : "guess"} title={set ? "Health you set" : "Suggested from overdue, stuck and risk items"}>
      <span className="size-1.5 rounded-[2px]" style={{ background: dot }} />
      {h}
      {!set && <span className="font-mono text-[0.62rem] opacity-70">suggested</span>}
    </Chip>
  );
}

function NewProject() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  if (!open) return <button className="btn btn-primary" onClick={() => setOpen(true)}>+ New project</button>;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createProjectAction({ name, kind: "Project", state: "Active", health: "Not set" });
          if (r.ok) {
            setOpen(false);
            setName("");
            router.refresh();
          } else setErr(r.error);
        });
      }}
    >
      <input autoFocus className="field w-56" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </form>
  );
}

export function ProjectsView({ entries, projects }: { entries: Entry[]; projects: Project[] }) {
  const mounted = useMounted();
  const [filter, setFilter] = useState<"active" | "hold" | "done" | "all">("active");
  const today = todayLocal();
  const rows = useMemo(
    () =>
      projects
        .filter((p) => (filter === "all" ? true : filter === "active" ? !p.state || p.state === "Active" : filter === "hold" ? p.state === "On hold" : p.state === "Done"))
        .map((p) => ({ p, s: projectStats(p, entries, today) }))
        .sort((a, b) => {
          const ha = a.p.health && a.p.health !== "Not set" ? a.p.health : a.s.suggested;
          const hb = b.p.health && b.p.health !== "Not set" ? b.p.health : b.s.suggested;
          return RANK[ha] - RANK[hb] || (a.p.priority ?? "P9").localeCompare(b.p.priority ?? "P9");
        }),
    [projects, entries, filter, today],
  );
  const all = projects.filter((p) => !p.state || p.state === "Active").map((p) => ({ p, s: projectStats(p, entries, today) }));
  const health = (x: (typeof all)[number]) => (x.p.health && x.p.health !== "Not set" ? x.p.health : x.s.suggested);

  return (
    <div>
      <PageHeader title="Projects" subtitle="Every project at a glance: health, what is open, what is stuck and what it is spending." actions={<NewProject />} />
      {mounted && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            <Kpi label="Active" value={all.length} />
            <Kpi label="On track" value={all.filter((x) => health(x) === "On track").length} tone="ok" />
            <Kpi label="At risk" value={all.filter((x) => health(x) === "At risk").length} tone="warn" />
            <Kpi label="Off track" value={all.filter((x) => health(x) === "Off track").length} tone="danger" />
            <Kpi label="Spend pending" value={moneyShort(all.reduce((s, x) => s + x.s.spend, 0))} tone="accent" />
          </div>
          <Tabs label="Show" value={filter} onChange={setFilter} options={[["active", "Active"], ["hold", "On hold"], ["done", "Done"], ["all", "All"]]} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {rows.map(({ p, s }) => {
              const total = s.entries.filter((e) => e.type && ["Request", "Purchase Request", "Service Request", "Question", "Blocker / Risk"].includes(e.type)).length;
              const closed = s.entries.filter((e) => e.type && ["Request", "Purchase Request", "Service Request", "Question", "Blocker / Risk"].includes(e.type) && isClosed(e)).length;
              const late = p.targetDate && p.targetDate < today;
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="card block min-w-0 p-4 transition hover:border-[color-mix(in_oklch,var(--accent)_45%,var(--line))]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-ink">{p.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-ink-3">
                        {[p.kind, p.priority, p.nextMilestone && `Next: ${p.nextMilestone}`].filter(Boolean).join(" · ") || "No details yet"}
                      </p>
                    </div>
                    <HealthBadge health={p.health} suggested={s.suggested} />
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      ["Open", s.open.length, ""],
                      ["Overdue", s.overdue.length, s.overdue.length ? "text-danger" : ""],
                      ["Stuck", s.stuck.length, s.stuck.length ? "text-danger" : ""],
                      ["Waiting", s.waiting.length, s.waiting.length ? "text-warn" : ""],
                    ].map(([k, v, c]) => (
                      <div key={k as string} className="rounded-[calc(var(--radius)*0.6)] bg-surface-2/70 py-2">
                        <div className={`num text-lg ${c || "text-ink"}`}>{v}</div>
                        <div className="text-[0.68rem] text-ink-3">{k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Bar value={closed} max={Math.max(1, total)} />
                    <span className="num shrink-0 text-xs text-ink-3">{closed}/{total} asks closed</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
                    {p.targetDate && <span className={late ? "text-danger" : ""}>Target {shortDate(p.targetDate)}{late ? " (passed)" : ` · ${daysBetween(today, p.targetDate)}d left`}</span>}
                    {(s.spend > 0 || p.budget) && <span>Spend {money(s.spend) || "£0"}{p.budget ? ` of ${moneyShort(p.budget)}` : ""} pending</span>}
                    {s.lastActivity && <span>Active {s.quietDays === 0 ? "today" : `${s.quietDays}d ago`}</span>}
                  </div>
                </Link>
              );
            })}
            {!rows.length && <EmptyRow>No projects here.</EmptyRow>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectDetail({ project, entries, projects, people, tags }: { project: Project; entries: Entry[]; projects: Project[]; people: Ref[]; tags: string[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const today = todayLocal();
  const s = projectStats(project, entries, today);
  const [f, setF] = useState<ProjectInput>({
    health: project.health ?? "Not set",
    priority: project.priority ?? null,
    state: project.state ?? "Active",
    targetDate: project.targetDate ?? "",
    nextMilestone: project.nextMilestone ?? "",
    budget: project.budget ?? null,
    notes: project.notes ?? "",
  });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const recent = [...s.entries].sort((a, b) => loggedAt(b).localeCompare(loggedAt(a))).slice(0, 12);
  const proc = s.entries.filter((e) => isProcurement(e));
  const tag = `+${project.name.replace(/ /g, "_")} `;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/projects" className="text-xs text-ink-3 hover:text-ink">← Projects</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[1.85rem] text-ink">{project.name}</h1>
          <HealthBadge health={project.health} suggested={s.suggested} />
          {project.url !== "#" && (
            <a href={project.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-ink-3 hover:text-accent-fg">Open in Notion ↗</a>
          )}
        </div>
      </div>

      {mounted && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
          <Kpi label="Open asks" value={s.open.length} />
          <Kpi label="Overdue" value={s.overdue.length} tone={s.overdue.length ? "danger" : undefined} />
          <Kpi label="Stuck" value={s.stuck.length} tone={s.stuck.length ? "danger" : undefined} />
          <Kpi label="Spend pending" value={moneyShort(s.spend)} hint={project.budget ? `of ${moneyShort(project.budget)} budget` : undefined} tone="accent" />
          <Kpi label="Next due" value={s.nextDue ? shortDate(s.nextDue.due!, today) : "–"} hint={s.nextDue?.title} />
        </div>
      )}

      <CaptureBox people={people} projects={projects} tags={tags} compact initial={tag} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Section title="Open work" sub="Requests, purchase and service requests, questions and risks still open">
            <div className="divide-y divide-line">
              {mounted && s.open.map((e) => <WorkRow key={e.id} entry={e} today={today} people={people} showProject={false} right={e.waitingOn || e.status === "Waiting on others" ? <ChaseButton entry={e} compact /> : undefined} />)}
              {!s.open.length && <EmptyRow>Nothing open on this project.</EmptyRow>}
            </div>
          </Section>
          {proc.length > 0 && (
            <Section title="Procurement" sub={`${proc.length} purchase and service requests`}>
              <div className="divide-y divide-line">
                {mounted && proc.map((e) => <WorkRow key={e.id} entry={e} today={today} showProject={false} />)}
              </div>
            </Section>
          )}
          <Section title="Recent activity">
            <ul className="divide-y divide-line">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="num w-14 shrink-0 text-xs text-ink-3" suppressHydrationWarning>{mounted ? shortDate(loggedAt(e).slice(0, 10)) : ""}</span>
                  <TypeDot type={e.type} />
                  <Link href={`/entry/${e.id}`} className="truncate text-sm text-ink-2 hover:text-ink">{e.title}</Link>
                </li>
              ))}
              {!recent.length && <EmptyRow>No entries yet. Capture with {tag.trim()} to link them here.</EmptyRow>}
            </ul>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Project details">
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Health" options={HEALTH} value={f.health} onChange={(v) => set("health", v)} />
                <SelectField label="Priority" options={PRIORITIES} value={f.priority} onChange={(v) => set("priority", v)} />
                <SelectField label="State" options={["Active", "On hold", "Done"] as const} value={f.state as "Active"} onChange={(v) => set("state", v)} />
                <Field label="Target date">
                  <input type="date" className="field" value={f.targetDate ?? ""} onChange={(e) => set("targetDate", e.target.value)} />
                </Field>
              </div>
              <Field label="Next milestone">
                <input className="field" value={f.nextMilestone ?? ""} onChange={(e) => set("nextMilestone", e.target.value)} />
              </Field>
              <Field label="Budget (£)">
                <input type="number" min={0} className="field" value={f.budget ?? ""} onChange={(e) => set("budget", e.target.value === "" ? null : Number(e.target.value))} />
              </Field>
              <Field label="Notes">
                <textarea rows={3} className="field" value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-primary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await updateProjectAction(project.id, { ...f, targetDate: f.targetDate || null });
                      setMsg(r.ok ? "Saved" : r.error);
                      if (r.ok) router.refresh();
                    })
                  }
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                {msg && <span className="text-xs text-ok">{msg}</span>}
              </div>
            </div>
          </Section>
          <Section title="Decisions" sub={`${s.decisions.length} logged`}>
            <ul className="divide-y divide-line">
              {s.decisions.slice(0, 6).map((e) => (
                <li key={e.id} className="px-4 py-2">
                  <Link href={`/entry/${e.id}`} className="text-sm text-ink hover:text-accent-fg">{e.title}</Link>
                  {e.rationale && <p className="mt-0.5 text-xs text-ink-3">{e.rationale}</p>}
                </li>
              ))}
              {!s.decisions.length && <EmptyRow>No decisions yet.</EmptyRow>}
            </ul>
          </Section>
          <Section title="Risks and blockers">
            <div className="divide-y divide-line">
              {mounted && s.risks.map((e) => <WorkRow key={e.id} entry={e} today={today} showProject={false} />)}
              {!s.risks.length && <EmptyRow>No open risks.</EmptyRow>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
