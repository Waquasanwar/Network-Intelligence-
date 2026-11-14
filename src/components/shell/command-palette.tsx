"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, CornerDownLeft } from "lucide-react";

type Item = { id: string; label: string; hint?: string; href: string; group: string };

/** Keyboard-first navigation. Items are passed in from the server layout (people + opportunities + pages). */
export function CommandPalette({ items }: { items: Item[] }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ni:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ni:open-palette", onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const matches = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? items.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(t)) : items.filter((i) => i.group === "Pages");
    return list.slice(0, 12);
  }, [q, items]);

  // Concierge: a plain-language query (more than one word) can be asked of the network directly.
  const ask: Item | null = /\s/.test(q.trim()) && q.trim().length >= 3
    ? { id: "__ask", label: q.trim(), hint: "Ask the network", href: `/network?q=${encodeURIComponent(q.trim())}`, group: "Ask" }
    : null;
  const results = React.useMemo(() => (ask ? [ask, ...matches] : matches), [ask, matches]);

  const go = (item: Item) => {
    setOpen(false);
    router.push(item.href);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-[#0f172a]/30 backdrop-blur-[2px] anim-fade" />
      <div className="absolute left-1/2 top-[14%] -translate-x-1/2 w-[580px] max-w-[92vw] rounded-[12px] bg-surface shadow-[var(--shadow-pop)] overflow-hidden anim-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 border-b border-line">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter" && results[idx]) go(results[idx]);
            }}
            placeholder="Search, or ask the network in plain language…"
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="max-h-[360px] overflow-y-auto py-1">
          {results.length === 0 ? <li className="px-3 py-6 text-center text-xs text-ink-faint">No results</li> : null}
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(r)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 cursor-pointer rounded-md mx-1 ${i === idx ? (r.id === "__ask" ? "bg-[linear-gradient(100deg,var(--color-navy-50),var(--color-surface))]" : "bg-navy-50") : ""}`} style={{ width: "calc(100% - 8px)" }}
              >
                {r.id === "__ask" ? <Sparkles className="h-4 w-4 text-navy flex-none" /> : null}
                <span className={`text-[13px] min-w-0 flex-1 truncate ${r.id === "__ask" ? "text-ink font-medium" : "text-ink"}`}>{r.id === "__ask" ? <><span className="text-ink-muted font-normal">Ask the network: </span>“{r.label}”</> : r.label}</span>
                {r.id === "__ask" && i === idx ? <CornerDownLeft className="h-3.5 w-3.5 text-ink-faint flex-none" /> : <span className="text-[11px] text-ink-faint truncate flex-none">{r.hint ?? r.group}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
