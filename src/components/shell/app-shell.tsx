import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { TopBar } from "./topbar";
import type { SessionUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal } from "@/lib/authz";
import { fullName } from "@/lib/utils";

export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pages = [
    { id: "p-overview", label: "Overview", href: "/overview", group: "Pages" },
    { id: "p-network", label: "Network", href: "/network", group: "Pages" },
    { id: "p-conversations", label: "Conversations", href: "/conversations", group: "Pages" },
    { id: "p-opportunities", label: "Opportunities", href: "/opportunities", group: "Pages" },
    { id: "p-amana", label: "Amana Expert Network", href: "/amana", group: "Pages" },
    { id: "p-partners", label: "Partners", href: "/partners", group: "Pages" },
    { id: "p-relocation", label: "Relocation", href: "/relocation", group: "Pages" },
    { id: "p-integrations", label: "Integrations", href: "/settings/integrations", group: "Pages" },
    { id: "p-security", label: "Security", href: "/settings/security", group: "Pages" },
  ];

  let items = pages;
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
    items = user.role === "PARTNER" ? [{ id: "p-portal", label: "Partner portal", href: "/partner-portal", group: "Pages" }] : [{ id: "p-client", label: "Client workspace", href: "/client-workspace", group: "Pages" }];
  }

  return (
    <div className="flex min-h-screen relative">
      <div className="ambient" aria-hidden="true" />
      <Sidebar user={user} />
      <div className="flex-1 min-w-0 flex flex-col relative z-[1]">
        <TopBar />
        <main className="flex-1">
          <div className="max-w-[1360px] mx-auto px-7 py-7 reveal">{children}</div>
        </main>
      </div>
      <CommandPalette items={items} />
    </div>
  );
}
