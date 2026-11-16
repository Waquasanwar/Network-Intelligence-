"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { importPeopleChunk, importSharesChunk, logEngagers, parseArchive, saveIcpAction, setPerson } from "@/app/actions";
import type { Icp } from "@/lib/people";

const CHUNK = 60;

/** Upload LinkedIn's data download; connections and posts are written to Notion in small batches with progress. */
export function ArchiveImport() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = phase != null && !phase.startsWith("Done");

  async function run(fd: FormData) {
    setError(null);
    setLog([]);
    setPhase("Reading file…");
    const parsed = await parseArchive(fd);
    if (!parsed.ok) return setPhase(null), setError(parsed.error);
    const { connections, shares, invitations, files } = parsed.data;
    const lines = [`Found ${files.join(", ")}: ${connections.length.toLocaleString("en-GB")} connections, ${shares.length} posts, ${invitations} invitations.`];
    setLog(lines);
    setTotal(connections.length + shares.length);
    let n = 0;
    let created = 0, updated = 0;
    for (let i = 0; i < connections.length; i += CHUNK) {
      setPhase(`Saving connections ${Math.min(i + CHUNK, connections.length).toLocaleString("en-GB")} of ${connections.length.toLocaleString("en-GB")}…`);
      const r = await importPeopleChunk(connections.slice(i, i + CHUNK));
      if (!r.ok) return setPhase(null), setError(r.error);
      created += r.data.created;
      updated += r.data.updated;
      n += Math.min(CHUNK, connections.length - i);
      setDone(n);
    }
    if (connections.length) lines.push(`Network: ${created} new, ${updated} updated.`);
    let posts = 0;
    for (let i = 0; i < shares.length; i += 25) {
      setPhase(`Adding your past posts ${Math.min(i + 25, shares.length)} of ${shares.length}…`);
      const r = await importSharesChunk(shares.slice(i, i + 25));
      if (!r.ok) return setPhase(null), setError(r.error);
      posts += r.data.created;
      n += Math.min(25, shares.length - i);
      setDone(n);
    }
    if (shares.length) lines.push(`Posts: ${posts} added to your library (rate them and add their numbers to train the rankings).`);
    setLog([...lines]);
    setPhase("Done.");
    ref.current?.reset();
    router.refresh();
  }

  return (
    <form ref={ref} className="stack" action={(fd) => void run(fd)}>
      <input type="file" name="file" accept=".zip,.csv" disabled={busy} />
      <div className="row">
        <button className="btn primary" disabled={busy}>{busy ? "Importing…" : "Import"}</button>
        {phase ? <span className="small muted" aria-live="polite">{phase}</span> : null}
      </div>
      {total ? (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
      ) : null}
      {log.length ? <ul className="small success" style={{ margin: 0, paddingLeft: 18 }}>{log.map((l) => <li key={l}>{l}</li>)}</ul> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function IcpForm({ icp, functions, seniorities }: { icp: Icp; functions: readonly string[]; seniorities: readonly string[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const list = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <form
      className="stack"
      action={(fd) =>
        start(async () => {
          const r = await saveIcpAction({
            functions: fd.getAll("functions").map(String),
            seniorities: fd.getAll("seniorities").map(String),
            titleKeywords: list(fd.get("titleKeywords")),
            companyKeywords: list(fd.get("companyKeywords")),
            excludeKeywords: list(fd.get("excludeKeywords")),
          });
          setMsg(r.ok ? "Saved. Leads re-scored." : r.error);
        })
      }
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Functions you sell to or want to reach</legend>
        <div className="chips">
          {functions.map((f) => (
            <label key={f}><input type="checkbox" name="functions" value={f} defaultChecked={icp.functions.includes(f)} />{f}</label>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Seniority</legend>
        <div className="chips">
          {seniorities.filter((s) => s !== "Unknown").map((s) => (
            <label key={s}><input type="checkbox" name="seniorities" value={s} defaultChecked={icp.seniorities.includes(s)} />{s}</label>
          ))}
        </div>
      </fieldset>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="tk">Title keywords</label>
          <input id="tk" name="titleKeywords" defaultValue={icp.titleKeywords.join(", ")} placeholder="talent, people, hiring" />
        </div>
        <div className="field">
          <label htmlFor="ck">Company keywords</label>
          <input id="ck" name="companyKeywords" defaultValue={icp.companyKeywords.join(", ")} placeholder="bank, fintech, insurer" />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ek">Exclude if title or company contains</label>
          <input id="ek" name="excludeKeywords" defaultValue={icp.excludeKeywords.join(", ")} placeholder="student, competitor name" />
        </div>
      </div>
      <div className="row">
        <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
        {msg ? <span className="small muted" aria-live="polite">{msg}</span> : null}
      </div>
    </form>
  );
}

const STATUSES = ["", "Target", "Warming up", "Contacted", "Replied", "Meeting", "Client", "Not a fit"];

export function PersonControls({ id, watch, status }: { id: string; watch: boolean; status: string | null }) {
  const [w, setW] = useState(watch);
  const [s, setS] = useState(status ?? "");
  return (
    <span className="ctrl">
      <button
        type="button"
        className="icon-btn"
        aria-pressed={w}
        aria-label={w ? "Remove from watchlist" : "Add to watchlist"}
        title={w ? "On your watchlist" : "Watch"}
        onClick={() => {
          setW(!w);
          void setPerson(id, { watch: !w });
        }}
      >
        {w ? "★" : "☆"}
      </button>
      <select
        aria-label="Lead status"
        value={s}
        onChange={(e) => {
          setS(e.target.value);
          void setPerson(id, { leadStatus: e.target.value || null });
        }}
      >
        {STATUSES.map((v) => <option key={v} value={v}>{v || "Status…"}</option>)}
      </select>
    </span>
  );
}

export function EngagerLogger({ posts }: { posts: { id: string; title: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      ref={ref}
      className="stack"
      action={(fd) =>
        start(async () => {
          const r = await logEngagers(String(fd.get("post")), String(fd.get("pasted") ?? ""));
          if (!r.ok) return setMsg({ ok: false, text: r.error });
          setMsg({ ok: true, text: r.data.matched.length ? `Marked ${r.data.matched.length} as engaged: ${r.data.matched.slice(0, 6).join(", ")}${r.data.matched.length > 6 ? "…" : ""}` : "No connections found in that text." });
          if (r.data.matched.length) ref.current?.reset();
        })
      }
    >
      <div className="field">
        <label htmlFor="eng-post">Post</label>
        <select id="eng-post" name="post" required>
          {posts.map((p) => <option key={p.id} value={p.id}>{p.title.slice(0, 80)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="eng-text">Paste the comments or the reactions list</label>
        <textarea id="eng-text" name="pasted" rows={5} placeholder={"On LinkedIn, open the post, expand comments or click the reaction count, select all and copy, then paste here."} required />
      </div>
      <div className="row">
        <button className="btn primary" disabled={pending}>{pending ? "Matching…" : "Find people"}</button>
        {msg ? <span className={`small ${msg.ok ? "success" : "error"}`} aria-live="polite">{msg.text}</span> : null}
      </div>
    </form>
  );
}
