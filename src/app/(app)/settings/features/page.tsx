import Link from "next/link";
import { redirect } from "next/navigation";
import { requireInternal } from "@/server/session";
import { canSeeMoney } from "@/lib/authz";
import { PageHeader } from "@/components/ui/page";
import { loadFeatures } from "@/server/queries";
import { FEATURES, AUDIENCES, storedFeaturesOf, type FeatureKey } from "@/lib/features";
import { setFeature } from "@/server/actions/settings";
import { prisma } from "@/lib/db";
import { AgentPulse, type PulseLine } from "@/components/ui/agent-pulse";
import { Coins, Volume2, UsersRound, Megaphone, Home, ClipboardList, UserPlus, Camera, Building2, Handshake, Globe } from "lucide-react";

const LOOK: Record<FeatureKey, { icon: typeof Coins; tone: string }> = {
  memberArea: { icon: Home, tone: "is-mint" }, memberScreening: { icon: ClipboardList, tone: "is-blue" }, readAloud: { icon: Volume2, tone: "is-blue" },
  memberReferrals: { icon: UserPlus, tone: "is-mint" }, communityBoard: { icon: Megaphone, tone: "is-coral" }, memberConnections: { icon: UsersRound, tone: "is-mint" },
  memberPhotos: { icon: Camera, tone: "is-blue" }, earnings: { icon: Coins, tone: "is-gold" },
  clientPortal: { icon: Building2, tone: "is-blue" }, agencyPortal: { icon: Handshake, tone: "is-gold" }, publicApplications: { icon: Globe, tone: "is-coral" },
};
const AUDIENCE_NOTE: Record<string, string> = {
  Members: "Privacy & data and Security stay open to every member whatever is switched, and people you invite can always join.",
  Clients: "Search for a client is switched on per account, in Requirements → Accounts, and needs the client portal.",
  Agencies: "",
  Public: "The public page always shows who you are and a way to sign in.",
};

export const metadata = { title: "Release" };

/**
 * The owner's switches. Each feature is built and tested; this is where it goes live for the
 * network, and where it can be paused again. Changes take effect for everyone at once.
 */
export default async function FeaturesPage() {
  const user = await requireInternal();
  if (!canSeeMoney(user)) redirect("/forbidden");
  const t = user.tenantId;
  const [on, tenant, members, credits, posts, connections] = await Promise.all([
    loadFeatures(t),
    prisma.tenant.findUnique({ where: { id: t }, select: { features: true } }),
    prisma.person.count({ where: { tenantId: t, memberUser: { isNot: null } } }),
    prisma.referralCredit.count({ where: { brief: { tenantId: t } } }),
    prisma.boardPost.count({ where: { tenantId: t, status: "OPEN" } }),
    prisma.connection.count({ where: { tenantId: t, status: "ACCEPTED" } }),
  ]);
  const set = storedFeaturesOf(tenant?.features);
  const released = FEATURES.filter((f) => on[f.key]).length;
  // The agent's read on what is ready, from what is already happening in the network.
  const pulse = ([
    !on.earnings && credits ? { text: `${credits} placement ${credits === 1 ? "share is" : "shares are"} recorded for members. Switch on Earnings when you are ready to show them` } : null,
    released ? null : { text: "Nothing is released yet: members, clients and agencies see only that their space is not open, and the public page is by invitation" },
    on.communityBoard ? { text: posts ? `${posts} ${posts === 1 ? "post is" : "posts are"} open on the community feed` : "The feed is quiet. A first post from you would get it going" } : null,
    on.memberConnections && connections ? { text: `${connections} ${connections === 1 ? "pair of members has" : "pairs of members have"} connected` } : null,
    { text: `Every switch reaches ${members} ${members === 1 ? "member" : "members"} at once, and each change is in the audit log` },
  ] as (PulseLine | null)[]).filter((x): x is PulseLine => !!x);
  return (
    <>
      <PageHeader title="Release" description={`What members, clients, agencies and the public can use. Everything starts off; switch each part on when you are ready, and off again at any time. ${released} of ${FEATURES.length} released.`} />
      <AgentPulse lines={pulse} className="mb-5 max-w-[860px]" />
      <div className="max-w-[860px] space-y-7" data-features>
        {AUDIENCES.map((who) => {
          const list = FEATURES.filter((f) => f.who === who);
          return (
            <section key={who} aria-labelledby={`aud-${who}`}>
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <h2 id={`aud-${who}`} className="text-[16px] font-semibold text-ink">{who}</h2>
                <span className="text-[12.5px] text-ink-faint">{list.filter((f) => on[f.key]).length} of {list.length} released</span>
              </div>
              <ul className="divide-y divide-line rounded-[16px] border border-line bg-surface">
                {list.map((f) => {
                  const chosen = set[f.key], live = on[f.key];
                  const parent = "requires" in f ? FEATURES.find((x) => x.key === f.requires) : null;
                  const waiting = chosen && !live && parent;
                  const L = LOOK[f.key];
                  return (
                    <li key={f.key} className="flex flex-col gap-3 px-5 py-4 first:rounded-t-[16px] last:rounded-b-[16px] sm:flex-row sm:items-center sm:justify-between" data-feature={f.key} data-on={live || undefined}>
                      <div className="flex min-w-0 gap-3.5">
                        <span className={`tile ${L.tone} mt-0.5`}><L.icon className="h-4 w-4" aria-hidden="true" /></span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="text-[15px] font-semibold text-ink">{f.label}</b>
                            <span className={`tag ${live ? "is-mint" : waiting ? "is-gold" : ""}`}>{live ? "Live" : waiting ? `Waits for ${parent!.label}` : "Off"}</span>
                          </div>
                          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-[1.5] text-ink-muted">{f.detail}</p>
                          {parent && !chosen && !on[parent.key] ? <p className="mt-1 text-[12px] text-ink-faint">Needs {parent.label} on as well.</p> : null}
                        </div>
                      </div>
                      <form action={setFeature} className="flex-none">
                        <input type="hidden" name="key" value={f.key} />
                        <input type="hidden" name="on" value={chosen ? "0" : "1"} />
                        <button type="submit" role="switch" aria-checked={chosen} aria-label={`${f.label}: ${chosen ? "on, switch off" : "off, switch on"}`} className="switch">
                          <span className="switch-knob" aria-hidden="true" />
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
              {AUDIENCE_NOTE[who] ? <p className="mt-2 text-[12.5px] text-ink-faint">{AUDIENCE_NOTE[who]}</p> : null}
            </section>
          );
        })}
      </div>
      <p className="mt-6 max-w-[860px] text-[13px] text-ink-faint">Search for companies and agencies is switched on per account, in <Link href="/requirements?tab=accounts" className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline">Requirements → Accounts</Link>.</p>
    </>
  );
}
