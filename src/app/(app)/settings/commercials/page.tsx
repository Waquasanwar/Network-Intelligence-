import { requireInternal } from "@/server/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { loadRateCard, saveRateCard } from "@/server/actions/demand";
import type { RateCard } from "@/lib/demand";

export const metadata = { title: "Commercials" };

export default async function CommercialsPage() {
  const user = await requireInternal();
  const rc = await loadRateCard(user.tenantId);
  const F = ({ name, label, hint }: { name: keyof RateCard; label: string; hint?: string }) => <Field label={label} hint={hint}><Input name={name} type="number" step="0.5" min={0} defaultValue={String(rc[name])} /></Field>;
  const H = ({ children }: { children: React.ReactNode }) => <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint pt-2">{children}</div>;
  return (
    <>
      <PageHeader title="Commercials" description="How we charge clients, agencies and Amana. Defaults for every new requirement; each account or brief can override them. Nothing here is hard-coded." />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader title="Rate card" />
            <CardBody>
              <form action={saveRateCard} className="space-y-3">
                <H>Permanent</H>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><F name="permPct" label="Direct client success fee %" hint="of first-year base salary" /><F name="agencyPermPct" label="Agency's own fee %" hint="what the agency charges its client" /><F name="agencyReferralSharePct" label="Our share of the agency fee %" hint="referral share on perm placements" /></div>
                <H>Contract · interim · fractional</H>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><F name="contractMarginPct" label="Direct client margin %" hint="of the billed day rate" /><F name="agencyContractMarginPct" label="Agency's margin %" hint="on the day rate" /><F name="agencyContractSharePct" label="Our share of the agency margin %" /><F name="workingDaysPerYear" label="Working days per year" /></div>
                <H>Advisory · Amana</H>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><F name="expertHourlyTakePct" label="Expert call take %" hint="platform share of the hourly rate" /><F name="defaultExpertHours" label="Default expert hours" /><F name="sowSharePct" label="SOW share %" hint="of SOW value for people we supply" /><F name="introductionFee" label="Flat introduction fee" /></div>
                <Field label="Currency"><Select name="currency" defaultValue={rc.currency} className="w-[140px]">{["GBP", "AED", "SAR", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
                <div className="flex justify-end"><SubmitButton pendingText="Saving…">Save rate card</SubmitButton></div>
              </form>
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="How the models work" description="Plain-English version of the rate card." />
          <CardBody><ul className="divide-y divide-line text-[12.5px]">{[["Direct client, permanent", "Success fee as a % of first-year base salary. Invoiced on start date."], ["Agency, permanent", "The agency charges its client; we take a referral share of that fee. Only licensed partners handle the placement."], ["Contract, interim, fractional", "A margin on the billed day rate for the length of the engagement, or a share of the agency's margin."], ["Amana expert calls", "A platform take on the expert's hourly rate. The expert receives the rest."], ["Amana SOW teams", "A share of the SOW value for people we bring to the team."], ["Agency access", "Optional monthly fee for portal access, set per account."]].map(([t, d]) => <li key={t} className="py-2 first:pt-0 last:pb-0"><div className="font-medium text-ink">{t}</div><div className="text-ink-muted">{d}</div></li>)}</ul></CardBody>
        </Card>
      </div>
    </>
  );
}
