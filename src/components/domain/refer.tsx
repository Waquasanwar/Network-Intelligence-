"use client";
import * as React from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { referPerson } from "@/server/actions/demand";
import { FEE_MODEL_LABELS } from "@/lib/demand";
import { ROUTE_LABELS } from "@/lib/labels";
import { Share2 } from "lucide-react";

export type ReferTarget = {
  accountId: string; accountName: string; kindLabel: string;
  briefs: { id: string; label: string; already: boolean }[];
};

/**
 * Put someone we know in front of a client or an agency — for a live requirement, perm or contract,
 * or on spec where there is no brief yet. They land in that portal as an anonymised card.
 */
export function ReferDrawer({ personId, personName, targets, suggestion, variant = "primary", size = "md", label = "Refer to a client or agency" }: {
  personId: string; personName: string; targets: ReferTarget[]; suggestion?: string | null;
  variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md"; label?: string;
}) {
  const [onSpec, setOnSpec] = React.useState(false);
  if (targets.length === 0) return null;
  return (
    <Drawer
      trigger={<Button variant={variant} size={size}><Share2 className="h-3.5 w-3.5" /> {label}</Button>}
      title={`Refer ${personName}`}
      description="Choose who to put them in front of. They appear in that client or agency's portal as an anonymised card — the name stays with us until an introduction is agreed and they say yes."
    >
      <form action={referPerson} className="space-y-4">
        <input type="hidden" name="personId" value={personId} />
        <Field label="Refer to" hint="A live requirement — perm or contract — or on spec where there is no brief yet" required>
          <Select name="target" required defaultValue="" onChange={(e) => setOnSpec(e.target.value.startsWith("spec:"))}>
            <option value="" disabled>— choose a client or agency —</option>
            {targets.map((t) => (
              <optgroup key={t.accountId} label={`${t.accountName} · ${t.kindLabel}`}>
                {t.briefs.map((b) => <option key={b.id} value={b.id} disabled={b.already}>{b.label}{b.already ? " — already proposed" : ""}</option>)}
                <option value={`spec:${t.accountId}`}>On spec — no requirement yet</option>
              </optgroup>
            ))}
          </Select>
        </Field>
        {onSpec ? (
          <Field label="Route for the on-spec introduction" hint="Perm, contract, interim or advisory. This sets the fee model.">
            <Select name="route" defaultValue=""><option value="">— their stated preference —</option>{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          </Field>
        ) : null}
        <Field label="What they read on the card" hint="No names, no employers — this is the line the client or agency sees.">
          <Textarea name="clientNote" defaultValue={suggestion ?? ""} placeholder="Why this person, in a sentence they can read." maxLength={300} />
        </Field>
        <div className="text-[11px] uppercase tracking-[0.08em] text-ink-faint pt-1">Fee</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fee model"><Select name="model" defaultValue=""><option value="">— keep the requirement&rsquo;s terms —</option>{Object.entries(FEE_MODEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Our %"><Input name="pct" type="number" step="0.5" min={0} placeholder="from the rate card" /></Field>
        </div>
        <Checkbox name="createFee" label="Create a forecast fee line against this person" defaultChecked />
        <div className="flex justify-end"><SubmitButton pendingText="Referring…">Refer them</SubmitButton></div>
      </form>
    </Drawer>
  );
}
