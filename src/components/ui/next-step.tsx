import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Step } from "@/server/next-step";

/**
 * One suggested next move for the page, worked out from the network's own state. A single line with
 * a single action: it prompts, it does not act, and it is absent when there is nothing to say.
 */
export function NextStep({ step }: { step: Step | null }) {
  if (!step) return null;
  return (
    <div className="next-step mb-5" role="note" aria-label="Suggested next step">
      <span className="ai-orb" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-ink"><span className="label-caps mr-2 text-ink-faint">Next</span>{step.text}</p>
      <Link href={step.href} className="group inline-flex h-8 flex-none items-center gap-1.5 rounded-full bg-navy px-3.5 text-[12.5px] font-semibold text-white dark:text-canvas">{step.label}<ArrowRight className="arrow-badge h-3.5 w-3.5" /></Link>
    </div>
  );
}
