"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

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

  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? items.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(t)) : items.filter((i) => i.group === "Pages");
    return list.slice(0, 12);
  }, [q, items]);

  const go = (item: Item) => {
    setOpen(false);
    router.push(item.href);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-ink/25 anim-fade" />
      <div className="absolute left-1/2 top-[14%] -translate-x-1/2 w-[580px] max-w-[92vw] rounded-xl bg-surface shadow-[var(--shadow-pop)] overflow-hidden anim-pop" onClick={(e) => e.stopPropagation()}>
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
            placeholder="Search people, opportunities, pages…"
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
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 cursor-pointer rounded-md mx-1 ${i === idx ? "bg-navy-50" : ""}`} style={{ width: "calc(100% - 8px)" }}
              >
                <span className="text-[13px] text-ink">{r.label}</span>
                <span className="text-[11px] text-ink-faint truncate">{r.hint ?? r.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
