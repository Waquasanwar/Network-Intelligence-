import Link from "next/link";
import { redirect } from "next/navigation";
import { requireInternal } from "@/server/session";
import { canSeeMoney } from "@/lib/authz";
import { PageHeader } from "@/components/ui/page";
import { loadFeatures } from "@/server/queries";
import { FEATURES } from "@/lib/features";
import { setFeature } from "@/server/actions/settings";
import { prisma } from "@/lib/db";
import { AgentPulse, type PulseLine } from "@/components/ui/agent-pulse";
import { Coins, Volume2, UsersRound, Megaphone } from "lucide-react";

const LOOK = { earnings: { icon: Coins, tone: "is-gold" }, readAloud: { icon: Volume2, tone: "is-blue" }, memberConnections: { icon: UsersRound, tone: "is-mint" }, communityBoard: { icon: Megaphone, tone: "is-coral" } } as const;

export const metadata = { title: "Features" };

/**
 * The owner's switches. Each feature is built and tested; this is where it goes live for the
 * network, and where it can be paused again. Changes take effect for everyone at once.
 */
export default async function FeaturesPage() {
  const user = await requireInternal();
  if (!canSeeMoney(user)) redirect("/forbidden");
  const t = user.tenantId;
  const [on, members, credits, posts, connections] = await Promise.all([
    loadFeatures(t),
    prisma.person.count({ where: { tenantId: t, memberUser: { isNot: null } } }),
    prisma.referralCredit.count({ where: { brief: { tenantId: t } } }),
    prisma.boardPost.count({ where: { tenantId: t, status: "OPEN" } }),
    prisma.connection.count({ where: { tenantId: t, status: "ACCEPTED" } }),
  ]);
  // The agent's read on what is ready, from what is already happening in the network.
  const pulse = ([
    !on.earnings && credits ? { text: `${credits} placement ${credits === 1 ? "share is" : "shares are"} recorded for members. Switch on Earnings when you are ready to show them` } : null,
    on.communityBoard ? { text: posts ? `${posts} ${posts === 1 ? "post is" : "posts are"} open on the community board` : "The board is quiet. A first post from you would get it going" } : { text: "With the board off, members cannot post work to you" },
    on.memberConnections && connections ? { text: `${connections} ${connections === 1 ? "pair of members has" : "pairs of members have"} connected` } : null,
    { text: `Every switch reaches ${members} ${members === 1 ? "member" : "members"} at once, and each change is in the audit log` },
  ] as (PulseLine | null)[]).filter((x): x is PulseLine => !!x);
  return (
    <>
      <PageHeader title="Features" description="Switch features on when you are ready, and off again at any time. Changes apply to everyone in the network at once." />
      <AgentPulse lines={pulse} className="mb-5 max-w-[860px]" />
      <ul className="max-w-[860px] divide-y divide-line rounded-[16px] border border-line bg-surface" data-features>
        {FEATURES.map((f) => {
          const live = on[f.key];
          const L = LOOK[f.key];
          return (
            <li key={f.key} className="flex flex-col gap-3 px-5 py-4 first:rounded-t-[16px] last:rounded-b-[16px] sm:flex-row sm:items-center sm:justify-between" data-feature={f.key} data-on={live || undefined}>
              <div className="flex min-w-0 gap-3.5">
              <span className={`tile ${L.tone} mt-0.5`}><L.icon className="h-4 w-4" aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[15px] font-semibold text-ink">{f.label}</b>
                  <span className={`tag ${live ? "is-mint" : "is-gold"}`}>{live ? "On" : "Off"}</span>
                  <span className="text-[12px] text-ink-faint">For {f.who.toLowerCase()}</span>
                </div>
                <p className="mt-1 max-w-[62ch] text-[13.5px] leading-[1.5] text-ink-muted">{f.detail}</p>
              </div>
              </div>
              <form action={setFeature} className="flex-none">
                <input type="hidden" name="key" value={f.key} />
                <input type="hidden" name="on" value={live ? "0" : "1"} />
                <button type="submit" role="switch" aria-checked={live} aria-label={`${f.label}: ${live ? "on, switch off" : "off, switch on"}`} className="switch">
                  <span className="switch-knob" aria-hidden="true" />
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 max-w-[860px] text-[13px] text-ink-faint">Search for companies and agencies is switched on per account, in <Link href="/requirements?tab=accounts" className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline">Requirements → Accounts</Link>.</p>
    </>
  );
}
