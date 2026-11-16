"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, MessagesSquare, Briefcase, Building2, Handshake, Plane, Plug, ShieldCheck, Upload, ListChecks, MonitorSmartphone, Percent, UserPlus, BadgeCheck, Link2, MicVocal, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

// The full platform — network, opportunities, placement, portals, commercials — is shown by
// default. Set NEXT_PUBLIC_FEATURE_PHASE23=false to collapse to the Phase-1 "build the network and
// get people signed up" view (the Workspaces group and opportunity KPIs hide; the routes still work).
const SHOW_PHASE23 = process.env.NEXT_PUBLIC_FEATURE_PHASE23 !== "false";

const INTERNAL_NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/network", label: "Network", icon: Users },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
];
const WORKSPACES = [
  { href: "/opportunities", label: "Opportunities", icon: Briefcase },
  { href: "/requirements", label: "Requirements", icon: ListChecks },
  { href: "/referrals", label: "Referrals & pitches", icon: UserPlus },
  { href: "/amana", label: "Amana Expert Network", icon: Building2 },
  { href: "/portal", label: "Client & agency portal", icon: MonitorSmartphone },
  { href: "/partners", label: "Partners", icon: Handshake },
  { href: "/relocation", label: "Relocation", icon: Plane },
];
const SETTINGS_NAV = [
  { href: "/invite", label: "Invite link", icon: Link2 },
  { href: "/network/import", label: "Import contacts", icon: Upload },
  { href: "/settings/screening", label: "Screening", icon: MicVocal },
  ...(SHOW_PHASE23 ? [{ href: "/settings/commercials", label: "Commercials", icon: Percent }] : []),
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];
const PARTNER_NAV = [{ href: "/portal", label: "Requirements", icon: ListChecks }, { href: "/partner-portal", label: "Partner portal", icon: Handshake }, { href: "/settings/security", label: "Security", icon: ShieldCheck }];
const MEMBER_NAV = [{ href: "/member", label: "My network profile", icon: BadgeCheck }, { href: "/member?tab=opportunities", label: "Opportunities", icon: Briefcase }, { href: "/member?tab=refer", label: "Refer someone", icon: UserPlus }, { href: "/member?tab=privacy", label: "Privacy & data", icon: Lock }, { href: "/settings/security", label: "Security", icon: ShieldCheck }];
const CLIENT_NAV = [{ href: "/portal", label: "Requirements", icon: ListChecks }, { href: "/client-workspace", label: "Client workspace", icon: Briefcase }, { href: "/settings/security", label: "Security", icon: ShieldCheck }];

export function Sidebar({ user }: { user: { name: string; email: string; role: Role; tenantName: string } }) {
  const pathname = usePathname();
  const restricted = user.role === "PARTNER" || user.role === "CLIENT" || user.role === "MEMBER";

  // Below the desktop breakpoint the rail becomes a drawer, opened from the top bar's menu button.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("ni:toggle-nav", toggle);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("ni:toggle-nav", toggle); window.removeEventListener("keydown", onKey); };
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]); // navigating closes it
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  const Item = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const active = href === "/network" ? pathname === "/network" || (pathname.startsWith("/network/") && !pathname.startsWith("/network/import")) : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex items-center gap-3 rounded-[6px] px-3 py-[11px] lg:py-[8px] text-[14px] lg:text-[13.5px] transition-[background-color,color] duration-200",
          active ? "bg-rail-active text-rail-ink-strong font-semibold" : "text-rail-ink font-medium hover:bg-rail-active hover:text-rail-ink-strong",
        )}
      >
        <Icon className={cn("h-4 w-4 flex-none transition-colors", active ? "text-rail-ink-strong" : "text-rail-ink group-hover:text-rail-ink-strong")} />
        <span className="flex-1 truncate">{label}</span>
        {active ? <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-[2px] bg-teal-400" /> : null}
      </Link>
    );
  };
  const Group = ({ label }: { label: string }) => <div className="label-caps px-3 pt-5 pb-2 text-ink-faint">{label}</div>;

  return (
    <>
    {open ? <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-x-0 bottom-0 top-14 z-20 bg-ink/35 lg:hidden cursor-default" /> : null}
    <aside id="app-nav" className={cn("rail-surface flex flex-col text-rail-ink border-r border-rail-line flex-none fixed top-14 bottom-0 left-0 z-30 w-[272px] max-w-[86vw] transition-[transform,visibility] duration-200 ease-out lg:sticky lg:top-14 lg:bottom-auto lg:h-[calc(100dvh-56px)] lg:z-auto lg:w-[248px] lg:translate-x-0 lg:visible", open ? "translate-x-0 visible shadow-[var(--shadow-drawer)] lg:shadow-none" : "-translate-x-full invisible")}>
      <nav className="px-3 flex-1 space-y-0.5 overflow-y-auto pt-4 pb-6">
        {restricted ? (user.role === "PARTNER" ? PARTNER_NAV : user.role === "MEMBER" ? MEMBER_NAV : CLIENT_NAV).map((i) => <Item key={i.href} {...i} />) : (
          <>
            {INTERNAL_NAV.map((i) => <Item key={i.href} {...i} />)}
            {SHOW_PHASE23 ? <><Group label="Workspaces" />{WORKSPACES.map((i) => <Item key={i.href} {...i} />)}</> : null}
            <Group label="Setup" />
            {SETTINGS_NAV.map((i) => <Item key={i.href} {...i} />)}
          </>
        )}
      </nav>
    </aside>
    </>
  );
}
