import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateText } from "./date";
import { fmt, shortlistLabel, type ShortlistDecision, type AccountKind } from "@/lib/demand";
import { Building2, Coins, Handshake } from "lucide-react";

export type ReferredRow = {
  itemId: string; briefId: string; briefTitle: string; routeLabel: string;
  accountName: string; kind: AccountKind; decision: ShortlistDecision; referred: boolean;
  clientNote: string | null; updatedAt: Date;
  fee: { ourTake: number; currency: string; statusLabel: string } | null;
  estimate: { ourTake: number; currency: string; basis: string; confident: boolean };
};

/** Every client and agency this person has been put in front of, with the fee that rides on it. Internal view only. */
export function ReferredCard({ rows, action }: { rows: ReferredRow[]; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title="Referred to" description="Perm or contract. They see the card, never the name — the fee is agreed with us." action={action} />
      <CardBody className="pt-0">
        {rows.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">Not yet put forward to anyone. Refer them and the client or agency sees an anonymised card.</p>
        ) : (
          <ul className="divide-y divide-line -my-1">
            {rows.map((r) => (
              <li key={r.itemId} className="py-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    {r.kind === "AGENCY" ? <Handshake className="h-3.5 w-3.5 text-ink-faint flex-none" /> : <Building2 className="h-3.5 w-3.5 text-ink-faint flex-none" />}
                    <b className="text-[13px] font-semibold truncate">{r.accountName}</b>
                  </span>
                  <Badge tone={r.decision === "PLACED" || r.decision === "INTRODUCED" ? "teal" : r.decision === "CLIENT_PASSED" ? "neutral" : "amber"} filled>{shortlistLabel(r.decision, r.kind)}</Badge>
                </div>
                <div className="text-[11.5px] text-ink-faint">
                  <Link href={`/requirements/${r.briefId}`} className="text-navy hover:underline">{r.briefTitle}</Link> · {r.routeLabel} · <DateText date={r.updatedAt} relative />
                  {r.referred ? <> · <span className="text-teal">referred by hand</span></> : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Coins className={`h-3.5 w-3.5 ${r.fee ? "text-teal" : "text-ink-faint"}`} />
                    <b className="text-[13px] tabular">{r.fee ? fmt(r.fee.ourTake, r.fee.currency) : r.estimate.confident ? fmt(r.estimate.ourTake, r.estimate.currency) : "fee to agree"}</b>
                  </span>
                  <small className="text-[11px] uppercase tracking-[0.06em] text-ink-faint">{r.fee ? r.fee.statusLabel : r.estimate.confident ? "estimated, no line yet" : r.estimate.basis}</small>
                </div>
                {r.clientNote ? <p className="text-[12px] text-ink-muted italic">“{r.clientNote}”</p> : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
