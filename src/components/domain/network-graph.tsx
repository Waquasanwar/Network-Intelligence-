"use client";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The network's shared shapes (people, introductions, the roles they fit) and the card shown when
 * someone is chosen on the map. The map itself is drawn by NetworkSky and TrustOrbit.
 */
/** An open requirement this person genuinely fits (from the matching engine, never a guess). */
export type GRole = { id: string; title: string; route: string | null; location: string | null; tier: "meets" | "conversation"; fit: number };
export type GNode = {
  id: string; name: string; headline: string; trust: number; worked: boolean; hub?: boolean;
  band?: string; vouchedBy?: number; capabilities?: string[]; city?: string | null;
  availability?: string; availabilityTone?: "teal" | "amber" | "neutral"; open?: boolean;
  member?: boolean; screened?: boolean; roles?: GRole[];
  /** Their photo, sent only for the orbit view and only where they agreed to show it. */
  photo?: string | null;
  /** Days since they were added. Under 30 counts as new growth. */
  addedDays?: number;
};
export type GLink = { source: string; target: string; worked: boolean };

const initials = (name: string) => name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
const TONE: Record<string, string> = { teal: "text-teal border-teal/30 bg-teal-50", amber: "text-amber border-amber/30 bg-amber-50", neutral: "text-ink-muted border-line bg-surface-muted" };

export function PersonCard({ n, connections, onClose }: { n: GNode; connections: number; onClose: () => void }) {
  const roles = n.roles ?? [];
  return (
    <div>
      <div className="flex items-start gap-3 p-4">
        <span className="h-11 w-11 flex-none rounded-full bg-surface-muted text-ink text-[13px] font-semibold inline-flex items-center justify-center ring-1 ring-line">{initials(n.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[-0.01em] truncate">{n.name}</div>
          <div className="text-[12px] text-ink-muted leading-[1.4] line-clamp-2">{n.headline || "No headline yet"}</div>
        </div>
        <button type="button" onClick={onClose} className="flex-none -mr-1 -mt-1 p-1 rounded-md text-ink-faint hover:text-ink hover:bg-surface-muted cursor-pointer" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-line">
        <span className="relative h-11 w-11 flex-none rounded-full" style={{ background: `conic-gradient(var(--color-navy) ${Math.round(n.trust)}%, var(--color-line-strong) 0)` }}>
          <span className="absolute inset-[4px] rounded-full bg-surface grid place-items-center text-[12.5px] font-semibold tabular">{Math.round(n.trust)}</span>
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium">{n.band ?? "Trust"}</div>
          <div className="text-[11.5px] text-ink-muted">{n.vouchedBy != null ? `Vouched by ${n.vouchedBy}` : "Trust score"}{n.worked ? " · you've worked together" : ""} · {connections} link{connections === 1 ? "" : "s"} on the map</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 py-3 border-t border-line">
        {n.availability ? <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", TONE[n.availabilityTone ?? "neutral"])}>{n.availability}</span> : null}
        {n.city ? <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", TONE.neutral)}>{n.city}</span> : null}
        {n.screened ? <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", TONE.neutral)}>screened</span> : n.member ? <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", TONE.amber)}>awaiting screening</span> : null}
      </div>

      {n.capabilities?.length ? (
        <div className="px-4 py-3 border-t border-line">
          <div className="text-[11px] text-ink-faint mb-1.5">Strong at</div>
          <div className="flex flex-wrap gap-1">{n.capabilities.map((c) => <span key={c} className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted">{c}</span>)}</div>
        </div>
      ) : null}

      <div className="px-4 py-3 border-t border-line">
        <div className="text-[11px] text-ink-faint mb-1">Open roles they fit</div>
        {roles.length ? (
          <ul className="divide-y divide-line">
            {roles.map((r) => (
              <li key={r.id}>
                <Link href={`/requirements/${r.id}`} className="group flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium truncate group-hover:text-navy">{r.title}</span>
                    <span className="block text-[11px] text-ink-faint truncate">{[r.route, r.location].filter(Boolean).join(" · ") || "Route to confirm"}</span>
                  </span>
                  <span className={cn("flex-none rounded-full border px-2 py-0.5 text-[10.5px]", r.tier === "meets" ? TONE.teal : TONE.amber)}>{r.tier === "meets" ? "Strong fit" : "Worth a call"} · {Math.round(r.fit)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className="text-[12px] text-ink-muted">Nothing live matches them right now.</div>}
      </div>

      <div className="p-4 border-t border-line">
        <Link href={`/network/${n.id}`} className="flex h-9 items-center justify-center gap-1.5 rounded-[12px] bg-navy text-white text-[13px] font-semibold transition-colors duration-200 hover:bg-navy-600 dark:text-canvas">Open profile <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
    </div>
  );
}
