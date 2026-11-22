import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrackerStep = { label: string; count?: number; state: "done" | "current" | "todo" | "stopped" };

/**
 * Where something stands, as one line of steps: done steps filled in mint, the current one ringed,
 * later ones quiet. A stopped step (passed on, not taken forward) ends the line plainly, without alarm.
 * Each step also says its state in words for screen readers.
 */
export function Tracker({ steps, label, className }: { steps: TrackerStep[]; label: string; className?: string }) {
  return (
    <ol className={cn("tracker", className)} aria-label={label} tabIndex={0} data-tracker>
      {steps.map((s, i) => (
        <li key={s.label + i} className="tracker-step" data-state={s.state}>
          <span className="tracker-dot" aria-hidden="true">{s.state === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3.4} /> : null}</span>
          <span className="tracker-label">
            {s.label}
            {s.count ? <b className="tracker-count">{s.count}</b> : null}
            <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "current" ? " (now)" : s.state === "stopped" ? " (stopped here)" : ""}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Turn an ordered list of reached flags into steps: everything up to the last reached is done, the next is current. */
export function stepsFrom(labels: { label: string; reached: boolean; count?: number }[], stopped = false): TrackerStep[] {
  const last = labels.reduce((a, l, i) => (l.reached ? i : a), -1);
  return labels.map((l, i) => ({
    label: l.label, count: l.count,
    state: i <= last ? (stopped && i === last ? "stopped" : "done") : i === last + 1 && !stopped ? "current" : "todo",
  }));
}
