"use client";

import { Children, isValidElement, useEffect, useRef, useState } from "react";

/** "Good evening" in the viewer's own time zone. */
export function Greeting({ date }: { date: string }) {
  const [part, setPart] = useState<string | null>(null);
  useEffect(() => {
    const h = new Date().getHours();
    setPart(h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return <>{part ? `${part} · ` : ""}{date}</>;
}

const KEY = "studio:section-use";
type Use = Record<string, number>;
const read = (): Use => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
};

/**
 * Sections you use most rise to the top. Each click inside a section counts; counts fade by 10% a
 * day so the order follows what you use now. Stored only in this browser. Children need a `data-section` key.
 */
export function AdaptiveStack({ children }: { children: React.ReactNode }) {
  const [use, setUse] = useState<Use>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = read();
    const last = Number(u.__t ?? Date.now());
    const decay = Math.pow(0.9, (Date.now() - last) / 864e5);
    for (const k of Object.keys(u)) if (k !== "__t") u[k] *= decay;
    u.__t = Date.now();
    setUse(u);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const sec = (e.target as HTMLElement).closest("[data-section]") as HTMLElement | null;
      if (!sec) return;
      const k = sec.dataset.section!;
      setUse((prev) => {
        const next = { ...prev, [k]: (prev[k] ?? 0) + 1, __t: Date.now() };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  const items = Children.toArray(children).filter(isValidElement) as React.ReactElement<{ "data-section": string }>[];
  const ranked = [...items].map((c, i) => ({ k: c.props["data-section"], i })).sort((a, b) => (use[b.k] ?? 0) - (use[a.k] ?? 0) || a.i - b.i);
  const order = new Map(ranked.map((r, pos) => [r.k, pos]));
  const moved = ranked.some((r, pos) => r.i !== pos);

  return (
    <div ref={ref} className="adaptive">
      {items.map((c) => (
        <div key={c.props["data-section"]} style={{ order: order.get(c.props["data-section"]) }}>
          {c}
        </div>
      ))}
      {moved ? (
        <button
          type="button"
          className="adaptive-reset"
          style={{ order: 999 }}
          onClick={() => {
            try {
              localStorage.removeItem(KEY);
            } catch {}
            setUse({});
          }}
        >
          Sections are ordered by what you use most · reset order
        </button>
      ) : null}
    </div>
  );
}
