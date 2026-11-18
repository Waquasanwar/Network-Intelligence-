import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Standard } from "@/lib/standard";

/** Six pips, one per proof, lit when held. The standard at the size of a word. */
export function ProofPips({ s, className }: { s: Standard; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[3px] align-middle", className)} role="img" aria-label={`${s.line} held`}>
      {s.proofs.map((p) => <i key={p.key} className={cn("h-[9px] w-[5px] rounded-full", p.held ? "bg-teal" : "bg-line-strong")} />)}
    </span>
  );
}

/**
 * The six proofs as a list: what is on record for each one held, and for each one not yet held,
 * what would earn it. No boxes, no scores. Reads the same on a profile and on a member's own page.
 */
export function StandardMarks({ s, className }: { s: Standard; className?: string }) {
  return (
    <ul className={cn("space-y-2.5", className)} data-standard={s.held}>
      {s.proofs.map((p) => (
        <li key={p.key} className="flex gap-2.5" data-proof={p.key} data-held={p.held || undefined}>
          <span className={cn("mt-[1px] grid h-[18px] w-[18px] flex-none place-items-center rounded-full", p.held ? "bg-teal text-white dark:text-canvas" : "border border-dashed border-line-strong")} aria-hidden="true">{p.held ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
          <span className="min-w-0 leading-snug">
            <b className={cn("block text-[13px] font-semibold", p.held ? "text-ink" : "text-ink-muted")}>{p.title}<span className="sr-only">{p.held ? ": held" : ": not yet"}</span></b>
            <span className="block text-[12.5px] text-ink-muted">{p.fact}</span>
            {p.next ? <span className="block text-[12.5px] text-ink-faint">Next: {p.next}.</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A client or agency card: the proofs held, as a quiet ticked line. Names nobody. */
export function ProofLine({ proofs, className }: { proofs: string[]; className?: string }) {
  if (!proofs.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-muted", className)} aria-label="What we hold on record for this person">
      {proofs.map((p) => <li key={p} className="inline-flex items-center gap-1"><Check className="h-3 w-3 flex-none text-teal" strokeWidth={3} aria-hidden="true" />{p}</li>)}
    </ul>
  );
}
