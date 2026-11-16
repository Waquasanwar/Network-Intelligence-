"use client";

import { useRef, useState, useTransition } from "react";
import { importFile, logDay, syncNow } from "@/app/actions";

export function ImportForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      ref={ref}
      className="stack"
      action={(fd) =>
        start(async () => {
          const r = await importFile(fd);
          setResult(r.ok ? { ok: true, lines: r.data.summary } : { ok: false, lines: [r.error] });
          if (r.ok) ref.current?.reset();
        })
      }
    >
      <input type="file" name="file" accept=".xlsx" />
      <div>
        <button className="btn primary" disabled={pending}>{pending ? "Importing… (this can take a minute)" : "Import"}</button>
      </div>
      {result ? (
        <ul className={`small ${result.ok ? "success" : "error"}`} style={{ margin: 0, paddingLeft: 18 }}>
          {result.lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      ) : null}
    </form>
  );
}

export function LogDayForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      ref={ref}
      className="stack"
      action={(fd) =>
        start(async () => {
          const r = await logDay(fd);
          setMsg(r.ok ? { ok: true, text: "Logged." } : { ok: false, text: r.error });
          if (r.ok) ref.current?.reset();
        })
      }
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="day">Day</label>
          <input id="day" name="day" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="field">
          <label htmlFor="tf">Total followers</label>
          <input id="tf" name="totalFollowers" inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="pv">Profile viewers (past 90 days)</label>
          <input id="pv" name="profileViews" inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="sa">Search appearances (past 7 days)</label>
          <input id="sa" name="searchAppearances" inputMode="numeric" />
        </div>
      </div>
      <div>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Log"}</button>
      </div>
      {msg ? <p className={msg.ok ? "success" : "error"}>{msg.text}</p> : null}
    </form>
  );
}

export function SyncButton({ disabled }: { disabled: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div>
        <button
          className="btn"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await syncNow();
              if (!r.ok) return setMsg(r.error);
              const d = r.data;
              setMsg(
                [
                  d.analytics ? `${d.postsUpdated} posts updated, ${d.daysUpserted} days of account data.` : "No analytics permission yet, so only re-ranked.",
                  `${d.ranked} rank changes.`,
                  d.errors.length ? `Issues: ${d.errors.slice(0, 3).join("; ")}` : "",
                ].join(" "),
              );
            })
          }
        >
          {pending ? "Syncing…" : disabled ? "Re-rank posts" : "Sync now"}
        </button>
      </div>
      {msg ? <p className="small muted">{msg}</p> : null}
    </div>
  );
}
