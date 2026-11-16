"use client";

import { useState, useTransition } from "react";
import { markPublished, ratePost, saveManualMetrics, setStatus } from "@/app/actions";
import type { Metrics, Post, Ratings, Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { Card } from "./kit";
import { RATING_FIELDS, Scale, Stars } from "./rating";

export function RatingPanel({ post }: { post: Post }) {
  const [ratings, setRatings] = useState<Ratings>(post.ratings);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const update = (next: Ratings) => {
    setRatings(next);
    setSaved(false);
    start(async () => {
      const r = await ratePost(post.id, next);
      if (r.ok) setSaved(true);
    });
  };
  return (
    <Card title="Your rating" description="Rate before posting; compare with the result later." action={<span className="small faint" aria-live="polite">{pending ? "Saving…" : saved ? "Saved" : ""}</span>}>
      <div className="stack">
      {RATING_FIELDS.map(([key, label]) => (
        <div key={key} className="row between">
          <span>{label}</span>
          <Stars label={label} value={ratings[key]} onChange={(v) => update({ ...ratings, [key]: v })} />
        </div>
      ))}
      <div>
        <div className="small muted" style={{ marginBottom: 4 }}>Gut score (1–10)</div>
        <Scale label="Gut score" value={ratings.gut} onChange={(v) => update({ ...ratings, gut: v })} />
      </div>
      </div>
    </Card>
  );
}

export function StatusPanel({ post }: { post: Post }) {
  const [status, setS] = useState<Status>(post.status);
  const [url, setUrl] = useState(post.linkedinUrl ?? "");
  const [date, setDate] = useState(post.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card title="Status & link" description="Paste the LinkedIn link so analytics can be matched.">
      <div className="stack">
      <div className="field">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          value={status}
          onChange={(e) => {
            const s = e.target.value as Status;
            setS(s);
            start(async () => {
              const r = await setStatus(post.id, s);
              setMsg(r.ok ? "Status saved." : r.error);
            });
          }}
        >
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="url">LinkedIn post link</label>
        <input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/feed/update/urn:li:activity:…" />
      </div>
      <div className="field">
        <label htmlFor="date">Published on</label>
        <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await markPublished(post.id, url, date);
            if (r.ok) setS("Published");
            setMsg(r.ok ? "Saved. Imports and sync can now match analytics to this post." : r.error);
          })
        }
      >
        Save as published
      </button>
      {msg ? <p className="small muted">{msg}</p> : null}
      </div>
    </Card>
  );
}

const METRIC_FIELDS: [keyof Metrics, string][] = [
  ["impressions", "Impressions"],
  ["membersReached", "Members reached"],
  ["reactions", "Reactions"],
  ["comments", "Comments"],
  ["reposts", "Reposts"],
  ["saves", "Saves"],
  ["sends", "Sends"],
  ["profileViews", "Profile views from post"],
  ["followersGained", "Followers gained"],
  ["linkClicks", "Link clicks"],
];

export function MetricsForm({ post }: { post: Post }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(METRIC_FIELDS.map(([k]) => [k, post.metrics[k]?.toString() ?? ""])),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card title="Update numbers" description="Copy them from the post’s analytics on LinkedIn, or import its export. Each save is kept as a snapshot.">
      <div className="stack">
      <div className="form-grid">
        {METRIC_FIELDS.map(([k, label]) => (
          <div className="field" key={k}>
            <label htmlFor={`m-${k}`}>{label}</label>
            <input id={`m-${k}`} inputMode="numeric" value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <button
        className="btn primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const m: Partial<Metrics> = {};
            for (const [k] of METRIC_FIELDS) {
              const v = values[k].replace(/,/g, "").trim();
              if (v !== "" && Number.isFinite(Number(v))) m[k] = Number(v);
            }
            const r = await saveManualMetrics(post.id, m);
            setMsg(r.ok ? { ok: true, text: "Saved and re-ranked." } : { ok: false, text: r.error });
          })
        }
      >
        {pending ? "Saving…" : "Save numbers"}
      </button>
      {msg ? <p className={msg.ok ? "success" : "error"}>{msg.text}</p> : null}
      </div>
    </Card>
  );
}
