import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { AskDock } from "./ask-dock";
import { TopBar, Crumbs, SectionTabs } from "./topbar";
import type { SessionUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal } from "@/lib/authz";
import { fullName } from "@/lib/utils";
import { alertsFor, loadFeatures, resolveMemberPerson, resolvePortalAccount } from "@/server/queries";
import { notesFor } from "@/server/agent";

export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pages = [
    { id: "p-overview", label: "Home", href: "/overview", group: "Pages" },
    { id: "p-network", label: "Network", href: "/network", group: "Pages" },
    { id: "p-conversations", label: "Conversations", href: "/conversations", group: "Pages" },
    { id: "p-opportunities", label: "Opportunities", href: "/opportunities", group: "Pages" },
    { id: "p-amana", label: "Amana Expert Network", href: "/amana", group: "Pages" },
    { id: "p-requirements", label: "Requirements", href: "/requirements", group: "Pages" },
    { id: "p-map", label: "Network map", href: "/network/map", group: "Pages" },
    { id: "p-grow", label: "Grow the network", href: "/invite", group: "Pages" },
    { id: "p-partners", label: "Agencies", href: "/partners", group: "Pages" },
    { id: "p-relocation", label: "Relocation", href: "/relocation", group: "Pages" },
    { id: "p-integrations", label: "Integrations", href: "/settings/integrations", group: "Pages" },
    { id: "p-security", label: "Security", href: "/settings/security", group: "Pages" },
  ];

  const f = user.role === "MEMBER" ? await loadFeatures(user.tenantId) : null;
  // Messages and People live on Community; the board itself is on the member home.
  const community = !f || f.memberConnections;
  let items = pages;
  // The bell: what is waiting on the team, and what the agent has told this reader.
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const reader = isInternal(user) ? { tenantId: user.tenantId, audience: "OWNER" as const }
    : user.role === "MEMBER" ? await resolveMemberPerson(user, null).then((m) => (m ? { personId: m.id } : null))
    : await resolvePortalAccount(user, null).then((a) => (a ? { accountId: a.id } : null));
  const notes = reader ? await notesFor(reader, 12) : [];
  const alerts = [
    ...notes.map((n) => ({ kind: "Amana", text: n.title, href: n.href ?? (user.role === "MEMBER" ? "/member#from-amana" : "/"), when: day(n.when), tone: "teal" as const, unread: n.unread || (n.question && !n.answer) })),
    ...(isInternal(user) ? (await alertsFor(user.tenantId)).map((a) => ({ ...a, when: day(a.when) })) : []),
  ];
  if (isInternal(user)) {
    const [people, opps] = await Promise.all([
      prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true, preferredName: true, headline: true }, take: 500, orderBy: { updatedAt: "desc" } }),
      prisma.opportunity.findMany({ where: { tenantId: user.tenantId }, select: { id: true, title: true, clientName: true }, take: 200, orderBy: { updatedAt: "desc" } }),
    ]);
    items = [
      ...pages,
      ...people.map((p) => ({ id: `person-${p.id}`, label: fullName(p), hint: p.headline ?? "Person", href: `/network/${p.id}`, group: "People" })),
      ...opps.map((o) => ({ id: `opp-${o.id}`, label: o.title, hint: o.clientName ?? "Opportunity", href: `/opportunities/${o.id}`, group: "Opportunities" })),
    ];
  } else {
    items = user.role === "PARTNER" ? [{ id: "p-portal", label: "Partner portal", href: "/partner-portal", group: "Pages" }, { id: "p-req", label: "Requirements", href: "/portal", group: "Pages" }] : user.role === "MEMBER" ? [{ id: "p-member", label: "My network profile", href: "/member", group: "Pages" }] : [{ id: "p-client", label: "Client workspace", href: "/client-workspace", group: "Pages" }, { id: "p-req", label: "Requirements", href: "/portal", group: "Pages" }];
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} community={community} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar alerts={alerts} user={{ name: user.name, role: user.role, tenantName: user.tenantName }} home={user.role === "PARTNER" ? "/partner-portal" : user.role === "MEMBER" ? "/member" : user.role === "CLIENT" ? "/client-workspace" : "/overview"} />
        <main className="flex-1 min-w-0">
          <div className={`max-w-[1280px] mx-auto px-4 pt-1 sm:px-6 lg:px-8 ${isInternal(user) ? "pb-28" : "pb-10"}`}>
            {isInternal(user) ? <SectionTabs role={user.role} className="lg:hidden mb-4" /> : null}
            <Crumbs />
            <div className="reveal">{children}</div>
          </div>
        </main>
      </div>
      {isInternal(user) ? <AskDock /> : null}
      <CommandPalette items={items} />
    </div>
  );
}
