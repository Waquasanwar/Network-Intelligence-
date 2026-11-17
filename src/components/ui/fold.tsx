import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Something you open when you want it. Closed, it is one line, so a page can hold detail without
 * showing all of it at once. A plain <details>: it works without script and is announced properly.
 */
export function Fold({ summary, children, open, className, summaryClassName }: { summary: React.ReactNode; children: React.ReactNode; open?: boolean; className?: string; summaryClassName?: string }) {
  return (
    <details className={cn("fold", className)} open={open}>
      <summary className={summaryClassName}>
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronRight className="fold-chev h-4 w-4" aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}
