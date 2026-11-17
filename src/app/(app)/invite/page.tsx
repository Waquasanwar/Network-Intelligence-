import Link from "next/link";
import { ArrowRight, Globe, MailCheck, RotateCcw, UserCheck, Users } from "lucide-react";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { networkInviteToken } from "@/server/invites";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Fold } from "@/components/ui/fold";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarList } from "@/components/ui/charts";
import { SubmitButton } from "@/components/ui/submit-button";
import { DateText } from "@/components/domain/date";
import { InviteComposer, LinkShare, CopyInviteLink } from "@/components/domain/invite-share";
import { InviteContactDrawer } from "@/components/domain/invite-drawers";
import { resetNetworkLink, revokeInvite } from "@/server/actions/invites";
import { fullName } from "@/lib/utils";

export const metadata = { title: "Grow the network" };

const WEEK = 7 * 86_400_000;

export default async function InvitePage() {
  const user = await requireInternal();
  const tenantId = user.tenantId;
  const now = new Date();
  const since = new Date(now.getTime() - 8 * WEEK);
  const [token, total, joined, screened, live, invites, openInvites, notJoinedCount, notJoined, introduced, recentJoins] = await Promise.all([
    networkInviteToken(tenantId),
    prisma.person.count({ where: { tenantId } }),
    prisma.person.count({ where: { tenantId, memberUser: { isNot: null } } }),
    prisma.person.count({ where: { tenantId, OR: [{ screeningStatus: { in: ["SUBMITTED", "APPROVED"] } }, { screenedAt: { not: null } }] } }),
    prisma.person.count({ where: { tenantId, OR: [{ screeningStatus: "APPROVED" }, { screenedAt: { not: null } }] } }),
    prisma.invite.findMany({ where: { tenantId }, include: { inviterPerson: { select: { firstName: true, lastName: true } }, createdBy: { select: { name: true } }, joinedPerson: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.invite.findMany({ where: { tenantId, status: { in: ["SENT", "OPENED"] }, expiresAt: { gt: now }, personId: { not: null } }, select: { personId: true } }),
    prisma.person.count({ where: { tenantId, memberUser: null } }),
    prisma.person.findMany({ where: { tenantId, memberUser: null }, select: { id: true, firstName: true, lastName: true, headline: true, email: true, relationships: { select: { workedTogether: true }, take: 3 } }, orderBy: { updatedAt: "desc" }, take: 40 }),
    prisma.relationship.groupBy({ by: ["introducedById"], where: { introducedById: { not: null }, person: { tenantId } }, _count: { _all: true }, orderBy: { _count: { introducedById: "desc" } }, take: 6 }),
    prisma.person.findMany({ where: { tenantId, memberSince: { gte: since }, memberUser: { isNot: null } }, select: { memberSince: true } }),
  ]);
  const connectors = introduced.length ? await prisma.person.findMany({ where: { tenantId, id: { in: introduced.map((i) => i.introducedById!) } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const connectorRows = introduced.map((i) => { const p = connectors.find((c) => c.id === i.introducedById); return p ? { label: fullName(p), value: i._count._all, href: `/network/${p.id}` } : null; }).filter((r): r is { label: string; value: number; href: string } => !!r);

  const invited = new Set(openInvites.map((i) => i.personId));
  // People you have worked with first: they are the likeliest to say yes.
  const toInvite = notJoined.filter((p) => !invited.has(p.id)).sort((a, b) => Number(b.relationships.some((r) => r.workedTogether)) - Number(a.relationships.some((r) => r.workedTogether))).slice(0, 8);
  const from = user.name.split(" ")[0];
  const weeks = Array.from({ length: 8 }, (_, i) => { const start = now.getTime() - (8 - i) * WEEK; return recentJoins.filter((p) => p.memberSince && p.memberSince.getTime() >= start && p.memberSince.getTime() < start + WEEK).length; });
  const maxWeek = Math.max(1, ...weeks);
  const canReset = user.role === "OWNER" || user.role === "ADMIN";

  const steps = [
    { label: "In your network", value: total, hint: "Everyone you hold a profile for", icon: Users },
    { label: "Joined", value: joined, hint: "Have their own login", icon: UserCheck },
    { label: "Screening done", value: screened, hint: "Had the conversation", icon: MailCheck },
    { label: "Approved", value: live, hint: "Reviewed and on the radar", icon: Globe },
  ];
  const statusOf = (i: (typeof invites)[number]) => i.status === "JOINED" ? { text: "Joined", tone: "teal" as const } : i.status === "REVOKED" ? { text: "Cancelled", tone: "neutral" as const } : i.expiresAt < now ? { text: "Expired", tone: "neutral" as const } : i.status === "OPENED" ? { text: "Opened", tone: "navy" as const } : { text: "Sent", tone: "amber" as const };

  return (
    <>
      <PageHeader title="Grow the network" description="Bring in people you would put your name behind. They register, have their screening, and you review them before they go live." />

      <ol className="figures mb-6">
        {steps.map((st, i) => (
          <li key={st.label} className="figure">
            <span className="block text-[12.5px] font-medium text-ink-muted leading-tight">{st.label}</span>
            <span className="mt-2 block font-display num-grad text-[28px] sm:text-[32px] leading-none">{st.value}</span>
            <span className="mt-1.5 block text-[12px] text-ink-faint leading-snug">{i > 0 && total > 0 ? `${Math.round((st.value / total) * 100)}% of your network · ` : ""}{st.hint}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Invite someone by name" description="A personal invitation: it works once, lasts 30 days, and you see when it is opened and when they join." />
            <CardBody>
              <InviteComposer network={user.tenantName} from={from} />
              {total ? (
                <Fold className="mt-5 border-t border-line pt-4" summary={<span className="text-[13.5px] font-semibold text-ink">{notJoinedCount ? `Or invite someone you already know` : "Everyone you hold a profile for has joined"}{notJoinedCount ? <span className="ml-2 font-normal text-ink-faint">{notJoinedCount} of {total} have no login yet</span> : null}</span>}>
                  <div className="mt-2">
              {toInvite.length === 0 ? <EmptyState icon={UserCheck} title={notJoinedCount ? "Everyone here has an open invitation" : "Nobody left to invite"} description={notJoinedCount ? "Their invitations are listed below. Send a reminder by copying the link again." : "Add people to the network, or import your contacts, and they appear here."} action={<Link href="/network/import" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[13px] font-semibold text-ink hover:bg-surface-hover">Import contacts <ArrowRight className="h-3.5 w-3.5" /></Link>} /> : (
                <ul className="divide-y divide-line">
                  {toInvite.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-1">
                      <div className="min-w-0">
                        <Link href={`/network/${p.id}`} className="text-[14px] font-semibold text-ink hover:underline underline-offset-4">{fullName(p)}</Link>
                        <div className="text-[12.5px] text-ink-muted truncate">{p.headline ?? "No headline yet"}{p.relationships.some((r) => r.workedTogether) ? " · worked together" : ""}</div>
                      </div>
                      <InviteContactDrawer person={{ id: p.id, name: fullName(p), email: p.email }} network={user.tenantName} from={from} />
                    </li>
                  ))}
                </ul>
              )}
              {notJoinedCount > toInvite.length && toInvite.length > 0 ? <p className="text-[12.5px] text-ink-faint mt-3">Showing {toInvite.length}. Open anyone in <Link href="/network" className="text-ink-muted underline underline-offset-4 hover:text-ink">the network</Link> to invite them from their profile.</p> : null}
                  </div>
                </Fold>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Invitations" description="Personal invitations from you, your team and your members." />
            <CardBody className="px-0 pb-0">
              {invites.length === 0 ? <div className="px-6 pb-6"><EmptyState icon={MailCheck} title="No invitations sent yet" description="Invite someone by name above and it is tracked here: sent, opened, joined." /></div> : (
                <table className="data">
                  <thead><tr><th className="pl-6">Who</th><th>From</th><th>Status</th><th>Sent</th><th className="pr-6"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {invites.map((i) => { const st = statusOf(i); const open = st.text === "Sent" || st.text === "Opened"; return (
                      <tr key={i.id}>
                        <td className="pl-6"><div className="font-semibold text-[13.5px]">{i.joinedPerson ? <Link href={`/network/${i.joinedPerson.id}`} className="hover:underline underline-offset-4">{i.name}</Link> : i.name}</div>{i.email ? <div className="text-[12px] text-ink-faint">{i.email}</div> : null}</td>
                        <td className="text-[13px] text-ink-muted whitespace-nowrap">{i.inviterPerson ? fullName(i.inviterPerson) : i.createdBy?.name ?? "Team"}</td>
                        <td><Badge tone={st.tone} filled={st.text === "Joined"}>{st.text}</Badge></td>
                        <td className="text-[13px] text-ink-muted whitespace-nowrap"><DateText date={i.createdAt} relative /></td>
                        <td className="pr-6"><div className="flex items-center justify-end gap-1.5 whitespace-nowrap">{open ? <><CopyInviteLink inviteId={i.id} /><form action={revokeInvite}><input type="hidden" name="inviteId" value={i.id} /><SubmitButton size="sm" variant="ghost" pendingText="…">Cancel</SubmitButton></form></> : null}</div></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Your network link" description="One link anyone can use. Put it behind the Join button on your website, in your email signature or your LinkedIn profile." />
            <CardBody>
              <LinkShare token={token} network={user.tenantName} from={from} />
              {canReset ? (
                <form action={resetNetworkLink} className="mt-4 pt-4 border-t border-line flex items-start justify-between gap-3">
                  <p className="text-[12px] text-ink-faint leading-[1.5]">Shared somewhere it should not be? Replace it and every copy of the old link stops working.</p>
                  <SubmitButton size="sm" variant="secondary" pendingText="Replacing…" className="flex-none"><RotateCcw className="h-3.5 w-3.5" /> Reset link</SubmitButton>
                </form>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Joined, last 8 weeks" description={`${recentJoins.length} ${recentJoins.length === 1 ? "person" : "people"} created a login`} />
            <CardBody>
              <div className="flex items-end gap-2 h-[112px]" role="img" aria-label={`People who joined in each of the last 8 weeks, oldest first: ${weeks.join(", ")}`}>
                {weeks.map((n, i) => (
                  <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5" title={`${i === 7 ? "This week" : `${7 - i} week${7 - i === 1 ? "" : "s"} ago`}: ${n}`}>
                    <span className="text-[12px] font-semibold text-ink">{n || ""}</span>
                    <span className="w-full rounded-t-[6px] rounded-b-[2px]" style={{ height: `${Math.max(3, (n / maxWeek) * 76)}px`, background: !n ? "var(--color-series-track)" : i === 7 ? "var(--color-coral)" : "var(--color-series-1)" }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[12px] text-ink-faint mt-2"><span>8 weeks ago</span><span>This week</span></div>
              <Fold className="mt-4 border-t border-line pt-3" summary={<span className="text-[13px] font-semibold text-ink">Who brings people in</span>}>
                <div className="mt-3"><BarList rows={connectorRows} empty="No introductions recorded yet. When someone joins on a member's link, it shows here." /></div>
              </Fold>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
