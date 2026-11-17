"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { aiCritique, aiHooks, aiRewrite, audienceForDraft, publishNow, saveDraft } from "@/app/actions";
import type { Critique } from "@/lib/ai";
import { aboveTheFold, checks, firstLine, LINKEDIN_MAX_CHARS, stats } from "@/lib/text";
import type { Post, Ratings, Status } from "@/lib/types";
import { FORMATS, HOOK_TYPES } from "@/lib/types";
import { Dictate } from "./dictate";
import { Card, Chip } from "./kit";
import { RATING_FIELDS, Scale, Stars } from "./rating";

interface Props {
  post?: Post | null;
  pillars: string[];
  aiEnabled: boolean;
  canPublish: boolean;
  initialText?: string;
}

const DRAFT_KEY = "studio:unsaved-draft";
const emptyRatings: Ratings = { hook: null, clarity: null, value: null, voice: null, gut: null };

export function Editor({ post, pillars, aiEnabled, canPublish, initialText }: Props) {
  const router = useRouter();
  const [id, setId] = useState(post?.id);
  const [text, setText] = useState(post?.text ?? initialText ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [pillar, setPillar] = useState(post?.pillar ?? "");
  const [format, setFormat] = useState(post?.format ?? "Text");
  const [hookType, setHookType] = useState(post?.hookType ?? "");
  const [tags, setTags] = useState((post?.tags ?? []).join(", "));
  const [plannedFor, setPlannedFor] = useState(post?.plannedFor?.slice(0, 10) ?? "");
  const [ratings, setRatings] = useState<Ratings>(post?.ratings ?? emptyRatings);
  const [aiScore, setAiScore] = useState<number | null>(post?.aiScore ?? null);
  const [aiNotes, setAiNotes] = useState(post?.aiNotes ?? "");

  const [critique, setCritique] = useState<Critique | null>(null);
  const [hookIdeas, setHookIdeas] = useState<{ text: string; type: string; why: string }[]>([]);
  const [instruction, setInstruction] = useState("");
  const [undo, setUndo] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Keep an unsaved new draft in this browser so a refresh doesn't lose it.
  useEffect(() => {
    if (id || initialText) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved && !text) setText(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (id) return;
    try {
      if (text) localStorage.setItem(DRAFT_KEY, text);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [text, id]);

  type Aud = { total: number; matches: number; segments: { function: string; people: number }[]; keywords: string[]; top: { id: string; name: string; position: string; company: string; url: string | null; why: string }[] };
  const [aud, setAud] = useState<Aud | null>(null);
  useEffect(() => {
    if (text.trim().length < 60) return setAud(null);
    const t = setTimeout(async () => {
      const r = await audienceForDraft(text);
      if (r.ok) setAud(r.data);
    }, 900);
    return () => clearTimeout(t);
  }, [text]);

  const s = useMemo(() => stats(text), [text]);
  const list = useMemo(() => checks(text), [text]);
  const fold = aboveTheFold(text);
  const truncated = fold.length < text.trim().length;

  function save(status?: Status) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveDraft({
        id,
        text,
        title,
        status,
        pillar: pillar || null,
        format: format || null,
        hookType: hookType || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        ratings,
        aiScore,
        aiNotes,
        plannedFor: plannedFor || null,
      });
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setMessage({ kind: "success", text: status === "Ready" ? "Marked ready to post." : "Saved to Notion." });
      if (!id) {
        setId(res.data.id);
        // Update the address without re-rendering, so the confirmation stays on screen.
        window.history.replaceState(null, "", `/write?id=${res.data.id}`);
      }
    });
  }

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setMessage(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const scoreIt = () =>
    run("critique", async () => {
      const res = await aiCritique(text);
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setCritique(res.data);
      setAiScore(Math.round(res.data.score));
      setAiNotes([res.data.verdict, ...res.data.fixes.map((f) => `• ${f.issue}: ${f.suggestion}`)].join("\n"));
      if (!hookType) setHookType(res.data.suggestedHookType);
    });

  const getHooks = () =>
    run("hooks", async () => {
      const res = await aiHooks(text);
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setHookIdeas(res.data.hooks);
    });

  const doRewrite = () =>
    run("rewrite", async () => {
      const res = await aiRewrite(text, instruction);
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setUndo(text);
      setText(res.data.text);
      setMessage({ kind: "success", text: `Rewritten. ${res.data.changes.join(" ")}` });
    });

  function useHook(h: string, type: string) {
    setUndo(text);
    const rest = text.trim().split("\n").slice(1).join("\n");
    setText(`${h}\n${rest}`);
    setHookType(type);
  }

  const doPublish = () =>
    run("publish", async () => {
      if (!id) return setMessage({ kind: "error", text: "Save the draft first." });
      if (!confirm("Publish this post to LinkedIn now? It will be public.")) return;
      const saved = await saveDraft({ id, text, title });
      if (!saved.ok) return setMessage({ kind: "error", text: saved.error });
      const res = await publishNow(id);
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setMessage({ kind: "success", text: "Published." });
      router.push(`/posts/${id}`);
    });

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setMessage({ kind: "success", text: "Copied. After you post it, open the post here and paste its link so metrics can be matched." });
  }

  return (
    <div className="split">
      <div className="stack" style={{ gap: "var(--gap)" }}>
        <div className="card stack">
          <div className="field">
            <label htmlFor="text">Post</label>
            <textarea
              id="text"
              className="editor"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Start with the line that makes someone stop scrolling.\n\nThen deliver on it."}
            />
          </div>
          <div className="row between small">
            <span className={s.chars > LINKEDIN_MAX_CHARS ? "error" : "muted"}>
              {s.chars.toLocaleString()} / {LINKEDIN_MAX_CHARS.toLocaleString()} characters · {s.words} words
            </span>
            <span className="row" style={{ gap: 6 }}>
            <Dictate onText={useCallbackText(setText)} />
            {undo != null ? (
              <button className="btn small ghost" onClick={() => (setText(undo), setUndo(null))}>
                Undo last change
              </button>
            ) : null}
            </span>
          </div>
          <div className="grid g3">
            <div className="field">
              <label htmlFor="pillar">Pillar</label>
              <input id="pillar" list="pillars" value={pillar} onChange={(e) => setPillar(e.target.value)} placeholder="e.g. Lessons learned" />
              <datalist id="pillars">{pillars.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="field">
              <label htmlFor="format">Format</label>
              <select id="format" value={format} onChange={(e) => setFormat(e.target.value)}>
                {FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="hookType">Hook type</label>
              <select id="hookType" value={hookType} onChange={(e) => setHookType(e.target.value)}>
                <option value="">–</option>
                {HOOK_TYPES.map((h) => <option key={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div className="grid g3">
            <div className="field">
              <label htmlFor="title">Title (for your library)</label>
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={firstLine(text).slice(0, 60) || "Defaults to line one"} />
            </div>
            <div className="field">
              <label htmlFor="tags">Tags</label>
              <input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
            </div>
            <div className="field">
              <label htmlFor="planned">Plan to post on</label>
              <input id="planned" type="date" value={plannedFor} onChange={(e) => setPlannedFor(e.target.value)} />
            </div>
          </div>
        </div>

        <Card title="Rate it yourself" description="Rate before you post. The dashboard later shows how well your gut predicted the result.">
        <div className="stack">
          {RATING_FIELDS.map(([key, label, hint]) => (
            <div key={key} className="row between">
              <div>
                <div>{label}</div>
                <div className="small faint">{hint}</div>
              </div>
              <Stars label={label} value={ratings[key]} onChange={(v) => setRatings({ ...ratings, [key]: v })} />
            </div>
          ))}
          <div>
            <div>Gut score</div>
            <div className="small faint" style={{ marginBottom: 6 }}>
              How well will this do, compared with your usual post?
            </div>
            <Scale label="Gut score" value={ratings.gut} onChange={(v) => setRatings({ ...ratings, gut: v })} />
          </div>
        </div>
        </Card>

        <div className="row">
          <button className="btn primary" disabled={pending || !text.trim()} onClick={() => save()}>
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button className="btn" disabled={pending || !text.trim()} onClick={() => save("Ready")}>
            Save &amp; mark ready
          </button>
          <button className="btn" disabled={!text.trim()} onClick={copyAndOpen}>
            Copy &amp; open LinkedIn
          </button>
          {canPublish ? (
            <button className="btn" disabled={!!busy || !id} onClick={doPublish} title={id ? "" : "Save first"}>
              {busy === "publish" ? "Publishing…" : "Publish now"}
            </button>
          ) : null}
        </div>
        {message ? <p className={message.kind}>{message.text}</p> : null}
      </div>

      <div className="stack" style={{ gap: "var(--gap)" }}>
        <Card title="Preview" description="What shows in the feed before “see more”.">
          <div className="preview">
            {text.trim() ? (
              <>
                {fold}
                {truncated ? <span className="more"> …see more</span> : null}
              </>
            ) : (
              <span className="faint">Your post appears here the way it shows in the feed.</span>
            )}
          </div>
        </Card>

        <Card className="powder" title="Who will care" description="People in your network this draft speaks to. Updates as you type." action={aud ? <Chip tone="neutral">{aud.matches.toLocaleString("en-GB")} matches</Chip> : null}>
          {!aud ? (
            <p className="small faint">Write a few lines{" "}to see who in your network this is for.</p>
          ) : aud.total === 0 ? (
            <p className="small faint">Import your connections on the Audience &amp; network page to see who this reaches.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {aud.segments.length ? (
                <div className="chips">
                  {aud.segments.map((g) => <span key={g.function} className="chip powder">{g.function} · {g.people}</span>)}
                </div>
              ) : null}
              <ul className="who-list">
                {aud.top.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <b>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}</b>
                    <span>{[p.position, p.company].filter(Boolean).join(" · ")}</span>
                    <em>{p.why}</em>
                  </li>
                ))}
              </ul>
              <p className="small faint" style={{ margin: 0 }}>Tag one or two of them, or send it to them after posting. Early comments from the right people lift reach.</p>
            </div>
          )}
        </Card>

        <Card title="Checks" description="Run as you type.">
          {list.length ? (
            <ul className="checks">
              {list.map((c) => (
                <li key={c.id}>
                  <span className={`dot ${c.level}`} />
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small faint">Start writing to see checks.</p>
          )}
        </Card>

        <Card accent title="Writing assistant" description="Compares the draft with your best and weakest posts." action={aiScore != null ? <Chip>AI score {aiScore}</Chip> : null}>
        <div className="stack">
          {!aiEnabled ? (
            <p className="small muted">Add ANTHROPIC_API_KEY to score drafts against your best posts, get alternative hooks and rewrites.</p>
          ) : (
            <>
              <div className="row">
                <button className="btn small" disabled={!!busy || !text.trim()} onClick={scoreIt}>
                  {busy === "critique" ? "Scoring…" : "Score this draft"}
                </button>
                <button className="btn small" disabled={!!busy || !text.trim()} onClick={getHooks}>
                  {busy === "hooks" ? "Thinking…" : "5 better hooks"}
                </button>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Rewrite: e.g. shorter, more personal, add a story" />
                <button className="btn small" disabled={!!busy || !text.trim()} onClick={doRewrite}>
                  {busy === "rewrite" ? "Rewriting…" : "Rewrite"}
                </button>
              </div>
            </>
          )}

          {critique ? (
            <div className="stack small">
              <hr style={{ margin: "4px 0" }} />
              <p>
                <strong>{Math.round(critique.score)}/100.</strong> {critique.verdict}
              </p>
              <div className="row">
                {(["hook", "clarity", "value", "voice"] as const).map((k) => (
                  <span key={k} className="badge">
                    {k} {critique[k]}/5
                  </span>
                ))}
              </div>
              {critique.strengths.length ? (
                <div>
                  <h3>Working</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{critique.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              ) : null}
              {critique.fixes.length ? (
                <div>
                  <h3>Fix</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {critique.fixes.map((f) => (
                      <li key={f.issue}>
                        <strong>{f.issue}.</strong> {f.suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {hookIdeas.length ? (
            <div className="stack small">
              <hr style={{ margin: "4px 0" }} />
              {hookIdeas.map((h) => (
                <div key={h.text} className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <div>
                    <div>{h.text}</div>
                    <div className="faint">
                      {h.type} · {h.why}
                    </div>
                  </div>
                  <button className="btn small" onClick={() => useHook(h.text, h.type)}>
                    Use
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        </Card>
      </div>
    </div>
  );
}

/** Appends dictated speech to the draft, with a space or new line as needed. */
function useCallbackText(setText: React.Dispatch<React.SetStateAction<string>>) {
  return useCallback((t: string) => setText((cur) => (cur ? `${cur}${/\s$/.test(cur) ? "" : " "}${t}` : t)), [setText]);
}
