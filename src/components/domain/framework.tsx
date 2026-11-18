import { Check as Tick } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Fold } from "@/components/ui/fold";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { TRUST_BAND_LABEL } from "@/lib/trust";
import type { Framework, ManualKey } from "@/lib/framework";
import type { Standard } from "@/lib/standard";
import { setCheck } from "@/server/actions/checks";
import { Ring } from "@/components/domain/trust";
import { ProofPips } from "@/components/domain/standard";

const PLACEHOLDER: Record<ManualKey, string> = {
  email: "How, e.g. replied from it",
  linkedin: "e.g. matches, 12 years at HSBC",
  met: "e.g. video call, 3 Nov",
  personal: "e.g. worked together at PwC",
  qualifications: "What you looked up, e.g. ACCA 1234567",
};

/**
 * The team's view of trust: one score, then the five areas of the framework, each opening to its
 * checks. A check only you can confirm carries a "Mark as checked" with a short note of what you
 * looked at; once confirmed it shows who did it and when, and can be taken back.
 */
export function FrameworkCard({ f, proofs, personId, firstName, action }: { f: Framework; proofs: Standard; personId: string; firstName: string; action?: React.ReactNode }) {
  return (
    <Card data-framework={f.held}>
      <CardHeader title="Trust" action={action} />
      <CardBody>
        <div className="flex gap-4 items-start">
          <Ring score={f.score} label="of 100" size={72} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">{TRUST_BAND_LABEL[f.band]}</div>
            <p className="text-[12.5px] text-ink-muted mt-0.5">{f.held} of {f.of} checks on how well we know {firstName}. Every one is a fact on record or a check someone here made.</p>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-muted"><ProofPips s={proofs} />Clients see {proofs.line}</div>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {f.areas.map((a) => (
            <li key={a.key} data-area={a.key}>
              <Fold className="py-2.5" summary={
                <span className="flex items-center gap-3 min-w-0">
                  <span className="min-w-0 flex-1"><b className="block text-[13px] font-semibold text-ink">{a.title}</b><span className="block text-[12px] text-ink-faint truncate">{a.question}</span></span>
                  <span className="flex-none inline-flex items-center gap-[3px]" aria-hidden="true">{a.checks.map((c) => <i key={c.key} className={cn("h-[9px] w-[5px] rounded-full", c.held ? "bg-teal" : "bg-line-strong")} />)}</span>
                  <span className="flex-none w-9 text-right text-[12px] tabular text-ink-muted">{a.held}/{a.of}</span>
                </span>
              }>
                <ul className="mt-2 space-y-2.5 pb-1">
                  {a.checks.map((c) => (
                    <li key={c.key} className="flex gap-2.5" data-check={c.key} data-held={c.held || undefined}>
                      <span className={cn("mt-[1px] grid h-[18px] w-[18px] flex-none place-items-center rounded-full", c.held ? "bg-teal text-white dark:text-canvas" : "border border-dashed border-line-strong")} aria-hidden="true">{c.held ? <Tick className="h-3 w-3" strokeWidth={3} /> : null}</span>
                      <span className="min-w-0 flex-1 leading-snug">
                        <b className={cn("block text-[12.5px] font-semibold", c.held ? "text-ink" : "text-ink-muted")}>{c.title}<span className="sr-only">{c.held ? ": held" : ": not yet"}</span></b>
                        <span className="block text-[12px] text-ink-muted">{c.fact}</span>
                        {c.canSign && !c.held ? (
                          <form action={setCheck} className="mt-1.5 flex items-center gap-1.5">
                            <input type="hidden" name="personId" value={personId} /><input type="hidden" name="key" value={c.key} /><input type="hidden" name="on" value="1" />
                            <input name="note" maxLength={200} placeholder={PLACEHOLDER[c.key as ManualKey]} aria-label={`What you checked for ${c.title.toLowerCase()}`} className="h-8 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-2.5 text-[12px] outline-none focus:border-navy-400" />
                            <SubmitButton size="sm" variant="secondary" pendingText="…">Mark as checked</SubmitButton>
                          </form>
                        ) : null}
                        {c.canSign && c.signed ? (
                          <form action={setCheck} className="inline"><input type="hidden" name="personId" value={personId} /><input type="hidden" name="key" value={c.key} /><input type="hidden" name="on" value="0" /><button type="submit" className="text-[12px] text-ink-faint underline underline-offset-2 hover:text-ink">Undo</button></form>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Fold>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
