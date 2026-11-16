"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { addSwipe, aiIdeas, rateSwipe } from "@/app/actions";
import { HOOK_TYPES } from "@/lib/types";
import { Stars } from "./rating";

export function IdeaGenerator({ enabled }: { enabled: boolean }) {
  const [topic, setTopic] = useState("");
  const [ideas, setIdeas] = useState<{ title: string; angle: string; hook: string; pillar: string; why: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!enabled) return <p className="small muted">Add ANTHROPIC_API_KEY to get post ideas drawn from your best-performing posts and your swipe file.</p>;
  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Optional focus, e.g. hiring, a product launch, lessons from 2026" />
        <button
          className="btn primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await aiIdeas(topic);
              if (r.ok) setIdeas(r.data.ideas);
              else setError(r.error);
            })
          }
        >
          {pending ? "Thinking…" : "Suggest ideas"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {ideas.length ? (
        <div className="grid g2">
          {ideas.map((i) => (
            <div key={i.title} className="panel stack" style={{ gap: 6 }}>
              <div className="row between">
                <strong>{i.title}</strong>
                <span className="badge">{i.pillar}</span>
              </div>
              <div className="small">{i.angle}</div>
              <div className="small" style={{ fontStyle: "italic" }}>&ldquo;{i.hook}&rdquo;</div>
              <div className="small faint">{i.why}</div>
              <div>
                <Link className="btn small" href={`/write?text=${encodeURIComponent(`${i.hook}\n\n`)}`}>Start writing</Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SwipeForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      ref={ref}
      className="stack"
      action={(fd) =>
        start(async () => {
          if (rating) fd.set("rating", String(rating));
          const r = await addSwipe(fd);
          setMsg(r.ok ? { ok: true, text: "Saved to your swipe file." } : { ok: false, text: r.error });
          if (r.ok) {
            ref.current?.reset();
            setRating(null);
          }
        })
      }
    >
      <div className="field">
        <label htmlFor="s-text">Post text</label>
        <textarea id="s-text" name="text" rows={6} placeholder="Paste a post you wish you'd written" />
      </div>
      <div className="grid g2">
        <div className="field">
          <label htmlFor="s-author">Author</label>
          <input id="s-author" name="author" />
        </div>
        <div className="field">
          <label htmlFor="s-url">Link</label>
          <input id="s-url" name="url" type="url" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="s-why">Why it works</label>
        <input id="s-why" name="why" placeholder="e.g. specific number in line one, ends on a real question" />
      </div>
      <div className="grid g2">
        <div className="field">
          <label htmlFor="s-hook">Hook type</label>
          <select id="s-hook" name="hookType" defaultValue="">
            <option value="">–</option>
            {HOOK_TYPES.map((h) => <option key={h}>{h}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="s-tags">Tags</label>
          <input id="s-tags" name="tags" placeholder="comma, separated" />
        </div>
      </div>
      <div className="row between">
        <Stars label="Rating" value={rating} onChange={setRating} />
        <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
      {msg ? <p className={msg.ok ? "success" : "error"}>{msg.text}</p> : null}
    </form>
  );
}

export function SwipeRating({ id, value }: { id: string; value: number | null }) {
  const [v, setV] = useState(value);
  return (
    <Stars
      label="Rating"
      value={v}
      onChange={(n) => {
        setV(n);
        if (n) void rateSwipe(id, n);
      }}
    />
  );
}
