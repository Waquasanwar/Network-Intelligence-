"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureAction } from "@/app/actions";
import { parseCapture } from "@/lib/parse";
import { ENTRY_TYPES, type EntryType, type Ref } from "@/lib/schema";
import { shortDate, todayLocal } from "@/lib/format";
import { Chip, TypeDot } from "./ui";

const QUICK_TYPES: EntryType[] = ["Note", "Decision", "Request", "Purchase Request", "Service Request", "Question", "Blocker / Risk", "Win"];
const SHORT: Partial<Record<EntryType, string>> = { "Purchase Request": "Purchase", "Service Request": "Service", "Blocker / Risk": "Blocker" };

interface Props {
  people: Ref[];
  projects: Ref[];
  tags: string[];
  autoFocus?: boolean;
  onSaved?: () => void;
  compact?: boolean;
  /** Text to start with, e.g. "+Project_Name " on a project page. */
  initial?: string;
}

/** The token being typed at the caret, if it is a @person, +project or #tag. */
function activeToken(text: string, caret: number) {
  const before = text.slice(0, caret);
  const m = before.match(/(^|\s)([@+#])("?[^\s"]*)$/);
  if (!m) return null;
  return { sigil: m[2] as "@" | "+" | "#", query: m[3].replace(/^"/, ""), start: caret - m[2].length - m[3].length };
}

export function CaptureBox({ people, projects, tags, autoFocus, onSaved, compact, initial = "" }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initial);
  const [typeOverride, setTypeOverride] = useState<EntryType | null>(null);
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<{ tone: "ok" | "danger"; msg: string } | null>(null);

  const parsed = useMemo(() => parseCapture(text, todayLocal()), [text]);
  const type = typeOverride ?? parsed.type ?? "Note";

  const token = activeToken(text, caret);
  const suggestions = useMemo(() => {
    if (!token) return [];
    const pool = token.sigil === "@" ? people.map((p) => p.name) : token.sigil === "+" ? projects.map((p) => p.name) : tags;
    const q = token.query.toLowerCase().replace(/_/g, " ");
    return pool.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 6);
  }, [token, people, projects, tags]);

  useEffect(() => setPick(0), [token?.query, token?.sigil]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  function insert(name: string) {
    if (!token) return;
    const value = token.sigil === "#" ? name : name.includes(" ") ? name.replace(/ /g, "_") : name;
    const next = `${text.slice(0, token.start)}${token.sigil}${value} ${text.slice(caret)}`;
    const pos = token.start + token.sigil.length + value.length + 1;
    setText(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  }

  function save() {
    if (!parsed.title.trim() || pending) return;
    const p = parsed;
    start(async () => {
      const res = await captureAction({
        title: p.title,
        body: p.body,
        type,
        tags: p.tags,
        people: p.people,
        projects: p.projects,
        priority: p.priority,
        due: p.due,
        followUp: p.followUp,
        sentiment: p.sentiment,
        category: p.category,
        source: p.source,
        waitingOn: p.waitingOn,
        stage: type === "Purchase Request" || type === "Service Request" ? (p.stage ?? "Submitted") : p.stage,
        reference: p.reference,
        amount: p.amount,
        direction: p.direction,
        status: ["Request", "Purchase Request", "Service Request", "Question", "Blocker / Risk"].includes(type) ? (p.waitingOn ? "Waiting on others" : "Open") : "Inbox",
      });
      if (res.ok) {
        setText(initial);
        setTypeOverride(null);
        setFlash({ tone: "ok", msg: `Saved as ${type}` });
        router.refresh();
        onSaved?.();
        ref.current?.focus();
      } else {
        setFlash({ tone: "danger", msg: res.error });
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPick((p) => (p + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPick((p) => (p - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        insert(suggestions[pick]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  }

  const inferred = (f: string) => parsed.inferred.includes(f as never);

  return (
    <div className="card capture relative p-3">
      <label htmlFor="capture" className="sr-only">
        Capture a thought
      </label>
      <textarea
        id="capture"
        ref={ref}
        autoFocus={autoFocus}
        value={text}
        rows={compact ? 2 : 3}
        onChange={(e) => {
          setText(e.target.value);
          setCaret(e.target.selectionStart);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        placeholder="What just happened? e.g.  d: go with vendor B +Migration @Sarah #tooling due:fri"
        className="w-full resize-none bg-transparent text-[0.975rem] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none"
      />

      {suggestions.length > 0 && (
        <ul role="listbox" className="card absolute left-3 z-20 mt-1 w-64 overflow-hidden py-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={i === pick}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(s);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm ${i === pick ? "bg-accent-soft text-accent-fg" : "text-ink"}`}
              >
                {token?.sigil}
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
        {QUICK_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeOverride(t === type && typeOverride ? null : t)}
            aria-pressed={t === type}
            className={`rounded-md px-2 py-1 text-xs transition ${
              t === type ? "bg-accent text-accent-ink" : "bg-surface-2/80 text-ink-2 hover:text-ink"
            }`}
            title={t === type && !typeOverride && inferred("type") ? "Guessed from your wording" : undefined}
          >
            <span className="inline-flex items-center gap-1.5"><TypeDot type={t} />{SHORT[t] ?? t.split(" ")[0]}</span>
            {t === type && !typeOverride && inferred("type") && <span className="ml-1 font-mono text-[0.62rem] opacity-70">guessed</span>}
          </button>
        ))}
        <select
          aria-label="Other type"
          value={QUICK_TYPES.includes(type) ? "" : type}
          onChange={(e) => e.target.value && setTypeOverride(e.target.value as EntryType)}
          className="rounded-md bg-surface-2 px-1.5 py-1 text-xs text-ink-2"
        >
          <option value="">More…</option>
          {ENTRY_TYPES.filter((t) => !QUICK_TYPES.includes(t)).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {flash && (
            <span role="status" className={`text-xs ${flash.tone === "ok" ? "text-ok" : "text-danger"}`}>
              {flash.msg}
            </span>
          )}
          <button type="button" onClick={save} disabled={!parsed.title.trim() || pending} className="btn btn-primary py-1.5">
            {pending ? "Saving…" : "Save"} <kbd className="hidden opacity-80 sm:inline">↵</kbd>
          </button>
        </div>
      </div>

      {text.trim() && text !== initial && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs" aria-label="What will be saved">
          {parsed.projects.map((p) => (
            <Chip key={p} tone="accent">
              {p}
            </Chip>
          ))}
          {parsed.people.map((p) => (
            <Chip key={p}>@{p}</Chip>
          ))}
          {parsed.tags.map((t) => (
            <Chip key={t}>#{t}</Chip>
          ))}
          {parsed.category && <Chip tone="guess" title="Guessed from your wording">{parsed.category}</Chip>}
          {parsed.source && <Chip tone="guess" title="Guessed from your wording">via {parsed.source}</Chip>}
          {parsed.sentiment && (
            <Chip tone="guess" title="Guessed from your wording">{parsed.sentiment}</Chip>
          )}
          {parsed.priority && <Chip tone="warn">{parsed.priority}</Chip>}
          {parsed.amount !== undefined && <Chip tone="accent">£{parsed.amount.toLocaleString("en-GB")}</Chip>}
          {parsed.reference && <Chip>{parsed.reference}</Chip>}
          {(parsed.stage || type === "Purchase Request" || type === "Service Request") && <Chip>stage: {parsed.stage ?? "Submitted"}</Chip>}
          {parsed.waitingOn && <Chip tone={parsed.inferred.includes("waitingOn") ? "guess" : "warn"} title={parsed.inferred.includes("waitingOn") ? "Guessed from your wording" : undefined}>waiting on {parsed.waitingOn}</Chip>}
          {parsed.due && <Chip tone="warn">due {shortDate(parsed.due, todayLocal())}</Chip>}
          {parsed.followUp && <Chip>follow up {shortDate(parsed.followUp, todayLocal())}</Chip>}
          {parsed.direction && <Chip>{parsed.direction}</Chip>}
          {parsed.body && <Chip>+ {parsed.body.split("\n").length} line note</Chip>}
        </div>
      )}
      {!compact && !text && (
        <p className="mt-2 text-xs text-ink-3">
          <code>d:</code> decision · <code>r:</code> request · <code>pr:</code> purchase · <code>sr:</code> service · <code>q:</code> question · <code>^^</code> to management · <code>wait:procurement</code> ·{" "}
          <code>@person</code> · <code>+project</code> · <code>#tag</code> · <code>!1</code>–<code>!4</code> · <code>due:fri</code> ·{" "}
          <code>fu:3d</code> · Shift+Enter for notes
        </p>
      )}
    </div>
  );
}
