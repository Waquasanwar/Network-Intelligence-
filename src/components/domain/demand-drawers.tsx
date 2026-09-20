"use client";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createAccount, updateBrief, addFeeLine } from "@/server/actions/demand";
import { ROUTE_LABELS, SENIORITY_LABELS } from "@/lib/labels";
import { FEE_STATUS_LABELS } from "@/lib/demand";
import { Plus, Pencil } from "lucide-react";

const CURRENCIES = ["GBP", "AED", "SAR", "USD", "EUR"];

export function NewAccountDrawer({ defaultCurrency = "GBP" }: { defaultCurrency?: string }) {
  return (
    <Drawer trigger={<Button variant="secondary"><Plus className="h-3.5 w-3.5" /> New account</Button>} title="New account" description="A client, an agency, or an expert network that sends requirements and pays fees.">
      <form action={createAccount} className="space-y-4">
        <Field label="Name" required><Input name="name" required autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select name="kind" defaultValue="CLIENT"><option value="CLIENT">Client</option><option value="AGENCY">Agency</option><option value="EXPERT_NETWORK">Expert network</option></Select></Field>
          <Field label="Status"><Select name="status" defaultValue="PROSPECT"><option value="PROSPECT">Prospect</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></Select></Field>
          <Field label="Contact name"><Input name="contactName" /></Field>
          <Field label="Contact email"><Input name="contactEmail" type="email" /></Field>
          <Field label="Currency"><Select name="currency" defaultValue={defaultCurrency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Monthly access fee" hint="Optional, for agencies with portal access"><Input name="monthlyFee" type="number" min={0} /></Field>
        </div>
        <Checkbox name="portalEnabled" label="Portal access" defaultChecked />
        <Field label="Notes"><Textarea name="notes" /></Field>
        <div className="flex justify-end"><SubmitButton pendingText="Creating…">Create account</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export type EditableBrief = { id: string; rawText: string; title: string; engagementRoute: string | null; headcount: number; roles: string[]; capabilities: string[]; locations: string[]; workRights: string | null; seniority: string | null; sectors: string[]; budgetAmount: number | null; budgetKind: string | null; budgetCurrency: string | null; durationMonths: number | null; startBy: string | null; mustBeLocal: boolean; feeCurrency: string };

export function EditBriefDrawer({ b }: { b: EditableBrief }) {
  return (
    <Drawer width="lg" trigger={<Button variant="secondary"><Pencil className="h-3.5 w-3.5" /> Edit brief</Button>} title="Edit the brief" description="Correct anything the co-pilot read wrongly. Hard-requirement checks are re-run; your decisions are kept.">
      <form action={updateBrief} className="space-y-4">
        <input type="hidden" name="briefId" value={b.id} />
        <Field label="In their words"><Textarea name="rawText" defaultValue={b.rawText} className="min-h-[80px]" /></Field>
        <Field label="Title"><Input name="title" defaultValue={b.title} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Route"><Select name="engagementRoute" defaultValue={b.engagementRoute ?? ""}><option value="">— to confirm —</option>{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Headcount"><Input name="headcount" type="number" min={1} defaultValue={b.headcount} /></Field>
          <Field label="Roles" hint="Comma separated"><Input name="roles" defaultValue={b.roles.join(", ")} /></Field>
          <Field label="Capabilities to match" hint="Comma separated"><Input name="capabilities" defaultValue={b.capabilities.join(", ")} /></Field>
          <Field label="Locations"><Input name="locations" defaultValue={b.locations.join(", ")} /></Field>
          <Field label="Work rights required"><Input name="workRights" defaultValue={b.workRights ?? ""} placeholder="Right to work in UAE" /></Field>
          <Field label="Seniority"><Select name="seniority" defaultValue={b.seniority ?? ""}><option value="">—</option>{Object.entries(SENIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Sectors"><Input name="sectors" defaultValue={b.sectors.join(", ")} /></Field>
          <Field label="Budget amount"><Input name="budgetAmount" type="number" min={0} defaultValue={b.budgetAmount ?? ""} /></Field>
          <Field label="Budget kind"><Select name="budgetKind" defaultValue={b.budgetKind ?? "DAY_RATE"}><option value="SALARY">Salary (per year)</option><option value="DAY_RATE">Day rate</option><option value="HOURLY">Hourly</option><option value="PROJECT">Project / SOW value</option></Select></Field>
          <Field label="Currency"><Select name="budgetCurrency" defaultValue={b.budgetCurrency ?? b.feeCurrency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Duration (months)"><Input name="durationMonths" type="number" min={0} defaultValue={b.durationMonths ?? ""} /></Field>
          <Field label="Start by"><Input name="startBy" defaultValue={b.startBy ?? ""} /></Field>
        </div>
        <Checkbox name="mustBeLocal" label="Must already be in the location (no relocation)" defaultChecked={b.mustBeLocal} />
        <div className="flex justify-end"><SubmitButton pendingText="Saving…">Save brief</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function AddFeeDrawer({ briefId, people, defaults }: { briefId: string; people: { id: string; name: string }[]; defaults: { gross: number; ourTake: number; currency: string; basis: string } }) {
  return (
    <Drawer trigger={<Button size="sm" variant="ghost"><Plus className="h-3.5 w-3.5" /> Fee line</Button>} title="Add a fee line" description="Record a fee against this requirement.">
      <form action={addFeeLine} className="space-y-4">
        <input type="hidden" name="briefId" value={briefId} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Person"><Select name="personId" defaultValue=""><option value="">— none / whole brief —</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Status"><Select name="status" defaultValue="FORECAST">{Object.entries(FEE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Gross (what they pay)"><Input name="gross" type="number" min={0} defaultValue={defaults.gross || ""} /></Field>
          <Field label="Our take" required><Input name="ourTake" type="number" min={0} required defaultValue={defaults.ourTake || ""} /></Field>
          <Field label="Currency"><Select name="currency" defaultValue={defaults.currency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Basis"><Input name="basis" defaultValue={defaults.basis} /></Field>
        </div>
        <div className="flex justify-end"><SubmitButton pendingText="Adding…">Add fee line</SubmitButton></div>
      </form>
    </Drawer>
  );
}
