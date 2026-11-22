import { redirect } from "next/navigation";
import { NotOpen } from "@/components/domain/not-open";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isClient, isInternal, isPartner } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { getAIProvider } from "@/lib/ai";
import { ROUTE_LABELS } from "@/lib/labels";
import { resolvePortalAccount, isReleased, portalFeature } from "@/server/queries";
import { searchNetwork, MAX_RESULTS, type SearchFilters } from "@/server/search";
import { askAboutPerson } from "@/server/actions/search";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProofLine } from "@/components/domain/standard";
import type { EngagementRoute } from "@prisma/client";

export const metadata = { title: "Search the network" };

const ROUTES = Object.keys(ROUTE_LABELS) as EngagementRoute[];
const NOTICE: Record<string, string> = {
  asked: "Thank you. We will ask the person first. Once they agree, we introduce you, on the terms for your account.",
  gone: "That person is no longer in search results. Try searching again.",
  details: "Choose the kind of hire you have in mind.",
  "slow-down": "That is a lot of requests at once. Wait a minute and try again.",
  limit: "That is a lot of searching at once. Wait a minute and try again.",
};

/**
 * A client's or agency's own search: who in the network could fit, without names. They see what
 * people do, where, how available they are and the proofs they hold, and ask about anyone. Every
 * ask comes to the network first.
 */
export default async function PortalSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; route?: string; where?: string; now?: string; notice?: string; account?: string }> }) {
  const user = await requireUser();
  // Nothing reaches clients or agencies until the owner releases it (Settings → Release).
  if (!(await isReleased(user, portalFeature(user)))) return <NotOpen />;
  if (!isClient(user) && !isPartner(user) && !isInternal(user)) redirect("/forbidden");
  const sp = await searchParams;
  const account = await resolvePortalAccount(user, sp.account ?? null);
  if (!account) return <EmptyState title="No portal account" description="Your login is not connected to an account yet." />;
  const network = await prisma.tenant.findUnique({ where: { id: account.tenantId }, select: { name: true, brandName: true } });
  const name = network?.brandName ?? network?.name ?? "the network";

  if (!account.searchEnabled) {
    return (
      <>
        <PageHeader title="Search the network" description={`Find people in ${name} yourself, without names, and ask about anyone who fits.`} />
        <EmptyState title="Search is not switched on for your account" description={`Ask ${name} to switch it on. Until then, send a requirement and we come back with people who fit.`} />
      </>
    );
  }

  const f: SearchFilters = { q: (sp.q ?? "").trim().slice(0, 200), route: ROUTES.includes(sp.route as EngagementRoute) ? (sp.route as EngagementRoute) : null, where: (sp.where ?? "").trim().slice(0, 80), now: sp.now === "1" };
  const asked = !!(f.q || f.route || f.where || f.now);
  let results: Awaited<ReturnType<typeof searchNetwork>> = [];
  let limited = false;
  if (asked) {
    limited = !(await rateLimit("ai", `psearch:${user.id}`)).success;
    if (!limited) {
      const intent = f.q ? await getAIProvider().parseSearch(f.q) : null;
      results = await searchNetwork(account, f, intent);
      if (!isInternal(user)) await audit({ tenantId: account.tenantId, actorId: user.id, action: "portal.search", entityType: "CommercialAccount", entityId: account.id, metadata: { results: results.length, route: f.route, now: f.now } });
    }
  }
  const notice = limited ? NOTICE.limit : sp.notice ? NOTICE[sp.notice] : null;

  return (
    <>
      <PageHeader title="Search the network" description={`People in ${name} who chose to be findable. You see what they do and the proofs they hold, never a name. Ask about anyone, and we take it from there.`} />
      {notice ? <div role="status" className="mb-4 rounded-[12px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">{notice}</div> : null}
      <form method="get" className="mb-5 flex flex-wrap gap-2" role="search">
        {isInternal(user) ? <input type="hidden" name="account" value={account.id} /> : null}
        <Input name="q" defaultValue={f.q} placeholder="What do you need? e.g. finance transformation, banking" aria-label="What do you need?" className="h-10 basis-full lg:basis-0 lg:flex-1" />
        <Select name="route" defaultValue={f.route ?? ""} aria-label="Kind of hire" className="h-10 flex-1 min-w-[150px] lg:flex-none lg:w-[190px]"><option value="">Any kind of hire</option>{ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABELS[r]}</option>)}</Select>
        <Input name="where" defaultValue={f.where} placeholder="Where" aria-label="Where" className="h-10 flex-1 min-w-[120px] lg:flex-none lg:w-[150px]" />
        <label className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13px]"><input type="checkbox" name="now" value="1" defaultChecked={f.now} className="h-4 w-4 accent-[var(--color-navy)]" /> Available now</label>
        <SubmitButton pendingText="Searching…">Search</SubmitButton>
      </form>

      {!asked ? <EmptyState title="Search by skill, place or kind of hire" description="Results show what people do, their region, how available they are and which proofs they hold. Names are released only when the person agrees to an introduction." /> : (
        <Card>
          <CardHeader title={results.length ? `${results.length === MAX_RESULTS ? `The first ${MAX_RESULTS}` : results.length} ${results.length === 1 ? "person" : "people"} who could fit` : "Nobody matches that yet"} description={results.length ? "Ask about anyone. We ask them first, and introduce you once they agree." : "Try fewer words, another kind of hire, or send us the requirement and we will search the whole network for you."} />
          <CardBody className="pt-0">
            <ul className="divide-y divide-line">
              {results.map((r) => (
                <li key={r.ref} className="py-4" data-result>
                  <div className="flex items-center gap-2 min-w-0"><code className="text-[12px] bg-surface-muted rounded px-1.5 py-0.5">{r.ref}</code><b className="text-[14px] font-semibold truncate">{r.headlineSummary || "Profile"}</b></div>
                  <div className="mt-1.5 flex flex-wrap gap-1"><Chip>{r.region ?? "region undisclosed"}</Chip><Chip>availability: {r.availabilityBand}</Chip>{r.engagementPreferences.slice(0, 3).map((e) => <Chip key={e}>{ROUTE_LABELS[e as EngagementRoute] ?? e}</Chip>)}</div>
                  <ProofLine proofs={r.proofs} className="mt-2" />
                  <details className="mt-2.5"><summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden inline-flex h-8 items-center rounded-full bg-navy px-3.5 text-[12.5px] font-semibold text-white dark:text-canvas">Ask about {r.ref}</summary>
                    <form action={askAboutPerson} className="mt-3 max-w-[560px] space-y-2.5">
                      <input type="hidden" name="ref" value={r.ref} />{isInternal(user) ? <input type="hidden" name="accountId" value={account.id} /> : null}
                      <Field label="Kind of hire" required><Select name="route" defaultValue={f.route ?? "PERMANENT"}>{ROUTES.map((x) => <option key={x} value={x}>{ROUTE_LABELS[x]}</option>)}</Select></Field>
                      <Field label="What it is for" hint="Optional. The role or piece of work, where, for how long."><Textarea name="note" maxLength={1500} rows={3} /></Field>
                      <SubmitButton size="sm" pendingText="Sending…">Send to {name}</SubmitButton>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
