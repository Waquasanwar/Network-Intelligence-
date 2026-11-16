"use client";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown in place of the page when something fails. The shell stays, so the person is never stranded. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  // Messages thrown on purpose by our own actions are short and safe to show. Anything else —
  // and everything in production, where the framework withholds the text — gets plain guidance.
  const own = error.message && error.message.length < 160 && !/prisma|invalid `|ECONN|at \w+ \(|server components render/i.test(error.message) ? error.message : null;
  return (
    <div className="mx-auto max-w-[520px] py-16 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface ring-1 ring-line shadow-[var(--shadow-card)]"><TriangleAlert className="h-5 w-5 text-amber" /></span>
      <h1 className="font-display text-[24px] mt-5">That did not go through</h1>
      <p className="text-[14.5px] text-ink-muted mt-2.5 leading-[1.55]">{own ?? "Nothing was lost. Try again, and if it keeps happening go back and check what you entered."}</p>
      <div className="mt-6 flex justify-center gap-2.5">
        <Button onClick={reset}><RotateCcw className="h-3.5 w-3.5" /> Try again</Button>
        <Button variant="secondary" onClick={() => window.history.back()}>Go back</Button>
      </div>
      {error.digest ? <p className="mt-6 text-[12px] text-ink-faint">Reference {error.digest}</p> : null}
    </div>
  );
}
