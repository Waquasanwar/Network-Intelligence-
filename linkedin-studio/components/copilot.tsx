"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { askCopilot, copilotIndex } from "@/app/actions";
import type { CopilotAnswer } from "@/lib/copilot";

type Index = {
  posts: { id: string; title: string; status: string; rank: number | null }[];
  people: { id: string; name: string; sub: string; url: string | null }[];
  signals: { title: string; href: string }[];
  ai: boolean;
};
type Row = { key: string; group: string; label: string; sub?: string; run: () => void };

const PAGES: [string, string][] = [
  ["Dashboard", "/"], ["Write a post", "/write"], ["Posts", "/posts"], ["Audience & network", "/network"],
  ["Ideas & swipe file", "/swipe"], ["Metrics", "/metrics"], ["Connect & setup", "/connect"],
];
const EXAMPLES = ["What should I do today?", "Who are my top leads?", "What was my best post?", "How am I doing this week?", "When should I post?"];

/** ⌘K: jump anywhere, find any post or person, or ask the copilot in plain English. */
export function Copilot() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState<Index | null>(null);
  const [sel, setSel] = useState(0);
  const [thread, setThread] = useState<{ q: string; a?: CopilotAnswer; error?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    opener.current = document.activeElement as HTMLElement;
    setOpen(true);
    copilotIndex().then((r) => r.ok && setIdx(r.data));
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    setQ("");
    setSel(0);
    opener.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) hide();
        else show();
      }
    };
    const onOpen = () => show();
    window.addEventListener("keydown", onKey);
    window.addEventListener("copilot:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("copilot:open", onOpen);
    };
  }, [open, show, hide]);
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  const go = useCallback((href: string) => {
    hide();
    if (href.startsWith("http")) window.open(href, "_blank", "noopener");
    else router.push(href);
  }, [hide, router]);

  const ask = useCallback(async (question: string) => {
    const text = question.trim();
    if (!text) return;
    setBusy(true);
    setQ("");
    const history = thread.flatMap((t) => [{ role: "user" as const, content: t.q }, ...(t.a ? [{ role: "assistant" as const, content: t.a.text }] : [])]);
    setThread((t) => [...t, { q: text }]);
    const r = await askCopilot(text, history);
    setThread((t) => t.map((x, i) => (i === t.length - 1 ? (r.ok ? { q: text, a: r.data } : { q: text, error: r.error }) : x)));
    setBusy(false);
  }, [thread]);

  const rows: Row[] = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const out: Row[] = [];
    if (!ql) {
      for (const s of idx?.signals ?? []) out.push({ key: `s${s.title}`, group: "Today", label: s.title, run: () => go(s.href) });
      for (const e of EXAMPLES) out.push({ key: `e${e}`, group: "Ask", label: e, run: () => void ask(e) });
      for (const [l, h] of PAGES) out.push({ key: `p${h}`, group: "Go to", label: l, run: () => go(h) });
      return out;
    }
    out.push({ key: "ask", group: "Ask", label: `Ask: “${q.trim()}”`, sub: idx?.ai ? "Answered from your data with Claude" : "Answered from your data", run: () => void ask(q) });
    for (const [l, h] of PAGES) if (l.toLowerCase().includes(ql)) out.push({ key: `p${h}`, group: "Go to", label: l, run: () => go(h) });
    for (const p of idx?.posts ?? []) if (p.title.toLowerCase().includes(ql)) out.push({ key: `post${p.id}`, group: "Posts", label: p.title, sub: `${p.status}${p.rank ? ` · #${p.rank}` : ""}`, run: () => go(p.status === "Published" ? `/posts/${p.id}` : `/write?id=${p.id}`) });
    let n = 0;
    for (const p of idx?.people ?? []) {
      if (n >= 8) break;
      if (`${p.name} ${p.sub}`.toLowerCase().includes(ql)) {
        out.push({ key: `pp${p.id}`, group: "People", label: p.name, sub: p.sub, run: () => go(p.url ?? "/network") });
        n++;
      }
    }
    return out.slice(0, 30);
  }, [q, idx, go, ask]);

  useEffect(() => setSel(0), [q]);

  if (!open)
    return (
      <button type="button" className="copilot-fab" onClick={show} aria-label="Open copilot (Ctrl or Cmd + K)">
        <span className="spark" aria-hidden>✦</span> Ask <kbd>⌘K</kbd>
      </button>
    );

  let lastGroup = "";
  return (
    <div className="copilot-scrim" onMouseDown={(e) => e.target === e.currentTarget && hide()}>
      <div className="copilot" role="dialog" aria-modal="true" aria-label="Copilot">
        <div className="copilot-input">
          <span className="spark" aria-hidden>✦</span>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask anything, or jump to a page, post or person…"
            aria-label="Ask or search"
            aria-controls="copilot-list"
            aria-activedescendant={rows[sel] ? `cp-${sel}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "Escape") hide();
              else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(rows.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); rows[sel]?.run(); }
            }}
          />
          <kbd>esc</kbd>
        </div>

        {thread.length ? (
          <div className="copilot-thread" aria-live="polite">
            {thread.map((t, i) => (
              <div key={i} className="turn">
                <div className="q">{t.q}</div>
                {t.error ? <div className="error">{t.error}</div> : !t.a ? (
                  <div className="thinking"><span className="shimmer-text">Thinking</span></div>
                ) : (
                  <div className="a">
                    <p>{t.a.text}</p>
                    {t.a.items?.length ? (
                      <ul>
                        {t.a.items.map((it) => (
                          <li key={it.label + it.href}>
                            <button type="button" onClick={() => go(it.href)}>
                              <b>{it.label}</b>
                              {it.sub ? <span>{it.sub}</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {t.a.actions?.length ? (
                      <div className="row" style={{ marginTop: 8 }}>
                        {t.a.actions.map((a) => <button key={a.href} type="button" className="btn small" onClick={() => go(a.href)}>{a.label}</button>)}
                      </div>
                    ) : null}
                    <div className="src">{t.a.source === "ai" ? "Claude, using your data" : "From your data"}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <ul className="copilot-list" id="copilot-list" role="listbox" aria-label="Suggestions">
          {rows.map((r, i) => {
            const head = r.group !== lastGroup ? (lastGroup = r.group) : null;
            return (
              <li key={r.key} role="presentation">
                {head ? <div className="group">{head}</div> : null}
                <button
                  type="button"
                  id={`cp-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  className={i === sel ? "on" : ""}
                  onMouseEnter={() => setSel(i)}
                  onClick={r.run}
                  disabled={busy && r.group === "Ask"}
                >
                  <b>{r.label}</b>
                  {r.sub ? <span>{r.sub}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="copilot-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open or ask</span><span><kbd>⌘K</kbd> toggle</span>
          <span style={{ marginLeft: "auto" }}>{idx?.ai ? "Claude connected" : "Local answers · add a Claude key for more"}</span>
        </div>
      </div>
    </div>
  );
}
