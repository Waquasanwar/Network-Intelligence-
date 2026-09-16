import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createOpportunity, approveIntroduction } from "@/server/actions/opportunities";
import { ROUTE_LABELS, SENIORITY_LABELS } from "@/lib/labels";
import { Plus, Handshake } from "lucide-react";
import type { EngagementRoute } from "@prisma/client";

export function NewOpportunityDrawer({ partners }: { partners: { id: string; name: string }[] }) {
  return (
    <Drawer width="lg" trigger={<Button><Plus className="h-3.5 w-3.5" /> New opportunity</Button>} title="New opportunity" description="Describe the problem. No CV, no formal job description needed.">
      <form action={createOpportunity} className="space-y-4">
        <Field label="Title" required><Input name="title" required placeholder="Stabilise a transformation programme and challenge the SI" autoFocus /></Field>
        <Field label="Business problem" required><Textarea name="problemStatement" required className="min-h-[100px]" placeholder="What is actually going wrong, for whom, and what does good look like?" /></Field>
        <Field label="Desired outcomes"><Textarea name="desiredOutcomes" placeholder="What must be true in 60 / 90 / 180 days?" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Source" required><Select name="sourceType" defaultValue="FOUNDER"><option value="FOUNDER">Founder</option><option value="AMANA">Amana</option><option value="PARTNER">Recruitment partner</option><option value="DIRECT_CLIENT">Direct client</option><option value="REFERRAL">Referral</option></Select></Field>
          <Field label="Client"><Input name="clientName" /></Field>
          <Field label="Partner (if any)"><Select name="partnerId" defaultValue=""><option value="">—</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Engagement route" required hint="Provisional — can change"><Select name="engagementRoute" defaultValue="SOW">{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Location"><Input name="location" placeholder="London (hybrid)" /></Field>
          <Field label="Duration"><Input name="duration" placeholder="6 months" /></Field>
          <Field label="Start date"><Input type="date" name="startDate" /></Field>
          <Field label="Budget" hint="day rate or salary"><Input name="budget" placeholder="1200" /></Field>
          <Field label="Currency"><Select name="currency" defaultValue="GBP"><option>GBP</option><option>AED</option><option>SAR</option><option>USD</option><option>EUR</option></Select></Field>
        </div>
        <Field label="Required capabilities" required hint="Comma separated"><Input name="requiredCapabilities" required placeholder="Programme director, Systems integrator challenge" /></Field>
        <Field label="Preferred capabilities" hint="Comma separated"><Input name="preferredCapabilities" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sectors" hint="Comma separated"><Input name="sectors" placeholder="Banking" /></Field>
          <Field label="Seniority"><Select name="seniority" defaultValue=""><option value="">—</option>{Object.entries(SENIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <div className="flex justify-end"><SubmitButton pendingText="Creating…">Create opportunity</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function ApproveIntroductionDrawer({ opportunityId, personId, personName, route, partners, existingId }: { opportunityId: string; personId: string; personName: string; route: EngagementRoute; partners: { id: string; name: string; licensedForPermanent: boolean; commercialSharePct: number | null }[]; existingId?: string }) {
  return (
    <Drawer trigger={<Button size="sm" variant="teal"><Handshake className="h-3.5 w-3.5" /> Approve introduction</Button>} title={`Introduce ${personName}`} description="Consent is requested from the person before any identity is shared. Permanent placements route through a licensed partner.">
      <form action={approveIntroduction} className="space-y-4">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="personId" value={personId} />
        {existingId ? <input type="hidden" name="introductionId" value={existingId} /> : null}
        <Field label="Route" required><Select name="route" defaultValue={route}>{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Recruitment partner" hint="Required for permanent placements"><Select name="recruitmentPartnerId" defaultValue=""><option value="">— none (direct / Amana) —</option>{partners.map((p) => <option key={p.id} value={p.id} disabled={!p.licensedForPermanent}>{p.name}{p.commercialSharePct ? ` · ${p.commercialSharePct}%` : ""}{!p.licensedForPermanent ? " (not licensed)" : ""}</option>)}</Select></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Commercial model"><Select name="commercialModel" defaultValue={route === "PERMANENT" ? "SUCCESS_SHARE" : route === "SOW" ? "AMANA_SOW" : "INTRODUCTION_FEE"}><option value="NONE">None</option><option value="INTRODUCTION_FEE">Introduction fee</option><option value="SUCCESS_SHARE">Success share</option><option value="SUBSCRIPTION_INCLUDED">Included in subscription</option><option value="AMANA_SOW">Amana SOW</option></Select></Field>
          <Field label="Share %"><Input name="commercialSharePct" type="number" step="0.5" min={0} max={100} placeholder="15" /></Field>
          <Field label="Value"><Input name="commercialValue" placeholder="150000" /></Field>
        </div>
        <Field label="Notes"><Textarea name="notes" placeholder="How the introduction will be made and by whom." /></Field>
        <div className="flex justify-end"><SubmitButton variant="teal" pendingText="Approving…">Approve and request consent</SubmitButton></div>
      </form>
    </Drawer>
  );
}
