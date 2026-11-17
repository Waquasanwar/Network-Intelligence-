import { cn } from "@/lib/utils";
import { CIRCLES } from "@/lib/circles";
import type { FitProfileRow } from "@/lib/fit";

/**
 * The drawn parts of a person's profile. All plain SVG from the theme's tokens, so they are sharp
 * at any size and follow light and dark. Each one states its value in words as well as in shape.
 */

/** The trust score as a ring around whatever sits inside it (the person's initials). */
export function TrustHalo({ score, size = 104, children }: { score: number; size?: number; children: React.ReactNode }) {
  const r = 46, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="img" aria-label={`Trust ${Math.round(pct)} out of 100`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <defs><linearGradient id="trust-halo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--color-teal-400)" /><stop offset="1" stopColor="var(--color-accent)" /></linearGradient></defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="5" />
        {pct > 0 ? <circle cx="50" cy="50" r={r} fill="none" stroke="url(#trust-halo)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} /> : null}
      </svg>
      <div className="absolute inset-[9px] grid place-items-center">{children}</div>
    </div>
  );
}

/** Which of the three circles someone sits in, drawn as the circles themselves. */
export function CircleGlyph({ ring, size = 44 }: { ring: 0 | 1 | 2; size?: number }) {
  const R = [7, 13, 19];
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} role="img" aria-label={CIRCLES[ring].label} className="flex-none">
      {[2, 1, 0].map((i) => <circle key={i} cx="22" cy="22" r={R[i]} fill={i === ring ? "color-mix(in srgb, var(--color-accent) 45%, transparent)" : "none"} stroke={i === ring ? "var(--color-teal-400)" : "var(--color-line-strong)"} strokeWidth={i === ring ? 1.6 : 1} />)}
      <circle cx="22" cy="22" r="2.4" fill="var(--color-ink)" />
      <circle cx={22 + R[ring] * 0.72} cy={22 - R[ring] * 0.72} r="3.4" fill="var(--color-coral)" stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  );
}

/** A half-dial for a 0–100 value. */
export function Dial({ value, size = 44, tone = "teal" }: { value: number; size?: number; tone?: "teal" | "amber" | "coral" }) {
  const pct = Math.max(0, Math.min(100, value)), len = Math.PI * 17;
  const stroke = tone === "amber" ? "var(--color-amber)" : tone === "coral" ? "var(--color-coral)" : "var(--color-teal-400)";
  return (
    <svg viewBox="0 0 44 28" width={size} height={(size * 28) / 44} aria-hidden="true" className="flex-none">
      <path d="M5 24 A17 17 0 0 1 39 24" fill="none" stroke="var(--color-line)" strokeWidth="5" strokeLinecap="round" />
      {pct > 0 ? <path d="M5 24 A17 17 0 0 1 39 24" fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * len} ${len}`} /> : null}
    </svg>
  );
}

/** One vital sign in the profile's top row: a small drawing, the value, and what it means. */
export function Vital({ graphic, label, value, hint }: { graphic: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-3.5 min-w-0">
      <span className="grid h-12 w-12 flex-none place-items-center">{graphic}</span>
      <span className="min-w-0">
        <span className="block text-[12px] text-ink-muted leading-tight">{label}</span>
        <span className="block font-display is-small text-[16.5px] leading-[1.25] text-ink truncate">{value}</span>
        {hint ? <span className="block text-[12px] text-ink-faint leading-tight truncate">{hint}</span> : null}
      </span>
    </div>
  );
}

/** People, as a short stack of dots: filled for each one counted, up to five. */
export function Stack({ count }: { count: number }) {
  return (
    <svg viewBox="0 0 44 28" width="44" height="28" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={8 + i * 7} cy="14" r="6" fill={i < count ? "var(--color-accent)" : "var(--color-surface-muted)"} stroke={i < count ? "var(--color-teal-400)" : "var(--color-line-strong)"} strokeWidth="1.2" strokeDasharray={i < count ? undefined : "2 2"} />)}
    </svg>
  );
}

/** Spoke labels short enough to sit beside the shape. The full names are in the list underneath. */
const SHORT: Record<string, string> = { conflict: "Conflict", political: "Political", commercial: "Commercial", ambiguity: "Ambiguity", influence: "Influence" };

/**
 * Working style as a radar: one spoke per attribute, 1 at the centre to 5 at the rim. The shape is
 * the combined view (their own answers and what people who vouched have observed).
 */
export function StyleRadar({ rows, className }: { rows: FitProfileRow[]; className?: string }) {
  const n = rows.length, cx = 190, cy = 130, R = 86;
  const pt = (i: number, v: number) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2, d = (Math.max(0, v) / 5) * R; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d] as const; };
  const poly = (vals: (number | null)[]) => vals.map((v, i) => pt(i, v ?? 0).map((x) => x.toFixed(1)).join(",")).join(" ");
  const scored = rows.filter((r) => r.combined !== null);
  if (scored.length < 3) return null;
  const summary = scored.map((r) => `${r.label} ${Math.round((r.combined ?? 0) * 10) / 10} of 5`).join(", ");
  return (
    <svg viewBox="0 0 380 260" className={cn("w-full max-w-[460px] h-auto", className)} role="img" aria-label={`Working style: ${summary}`}>
      {[1, 2, 3, 4, 5].map((lvl) => <polygon key={lvl} points={poly(rows.map(() => lvl))} fill={lvl === 5 ? "color-mix(in srgb, var(--color-accent) 7%, transparent)" : "none"} stroke="var(--color-line)" strokeWidth="1" />)}
      {rows.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-line)" strokeWidth="1" />; })}
      <polygon points={poly(rows.map((r) => r.combined))} fill="color-mix(in srgb, var(--color-teal-400) 26%, transparent)" stroke="var(--color-teal-400)" strokeWidth="2" strokeLinejoin="round" />
      {rows.map((r, i) => { if (r.combined === null) return null; const [x, y] = pt(i, r.combined); return <circle key={r.key} cx={x} cy={y} r="3.6" fill="var(--color-surface)" stroke="var(--color-teal-400)" strokeWidth="2" />; })}
      {rows.map((r, i) => { const [x, y] = pt(i, 6.15); const anchor = Math.abs(x - cx) < 12 ? "middle" : x > cx ? "start" : "end"; return <text key={r.key} x={x} y={y + 4} textAnchor={anchor} fontSize="11" fill="var(--color-ink-muted)">{SHORT[r.key] ?? r.label}</text>; })}
    </svg>
  );
}

/**
 * The last twelve months of contact, a column per month. A relationship that is being kept up
 * looks different at a glance from one that has gone quiet.
 */
export function ActivityStrip({ dates, now = new Date() }: { dates: Date[]; now?: Date }) {
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1); return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-GB", { month: "short" }), n: 0 }; });
  for (const d of dates) { const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`); if (m) m.n++; }
  const max = Math.max(1, ...months.map((m) => m.n)), total = months.reduce((a, m) => a + m.n, 0);
  return (
    <div>
      <div className="flex items-end gap-1.5 h-[64px]" role="img" aria-label={total ? `Contact in each of the last 12 months, oldest first: ${months.map((m) => `${m.label} ${m.n}`).join(", ")}` : "No recorded contact in the last 12 months"}>
        {months.map((m, i) => (
          <div key={m.key} className="flex-1 h-full flex flex-col justify-end" title={`${m.label}: ${m.n}`}>
            <span className="w-full rounded-t-[5px] rounded-b-[2px]" style={{ height: m.n ? `${Math.max(14, (m.n / max) * 100)}%` : "3px", background: !m.n ? "var(--color-series-track)" : i === 11 ? "var(--color-coral)" : "var(--color-series-1)" }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11.5px] text-ink-faint mt-1.5"><span>{months[0].label}</span><span>{months[5].label}</span><span>{months[11].label}</span></div>
      <p className="text-[12.5px] text-ink-muted mt-2">{total ? `${total} recorded ${total === 1 ? "contact" : "contacts"} in the last year.` : "Nothing recorded in the last year. A conversation or a vouch shows up here."}</p>
    </div>
  );
}
