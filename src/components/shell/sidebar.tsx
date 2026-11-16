"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, LayoutDashboard, Users, MessagesSquare, Briefcase, Building2, Handshake, Plane, Plug, ShieldCheck, Upload, ListChecks, MonitorSmartphone, Percent, UserPlus, BadgeCheck, MicVocal, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/ui/brand-mark";
import type { Role } from "@prisma/client";

// The full platform — network, opportunities, placement, portals, commercials — is shown by
// default. Set NEXT_PUBLIC_FEATURE_PHASE23=false to collapse to the Phase-1 "build the network and
// get people signed up" view (the Workspaces group and opportunity KPIs hide; the routes still work).
const SHOW_PHASE23 = process.env.NEXT_PUBLIC_FEATURE_PHASE23 !== "false";

const INTERNAL_NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/network", label: "Network", icon: Users },
  { href: "/invite", label: "Grow the network", icon: UserPlus },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
];
const WORKSPACES = [
  { href: "/opportunities", label: "Opportunities", icon: Briefcase },
  { href: "/requirements", label: "Requirements", icon: ListChecks },
  { href: "/referrals", label: "Referrals & pitches", icon: Handshake },
  { href: "/amana", label: "Amana Expert Network", icon: BadgeCheck },
  { href: "/portal", label: "Client & agency portal", icon: MonitorSmartphone },
  { href: "/partners", label: "Partners", icon: Building2 },
  { href: "/relocation", label: "Relocation", icon: Plane },
];
const SETTINGS_NAV = [
  { href: "/network/import", label: "Import contacts", icon: Upload },
  { href: "/settings/screening", label: "Screening", icon: MicVocal },
  ...(SHOW_PHASE23 ? [{ href: "/settings/commercials", label: "Commercials", icon: Percent }] : []),
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];
const PARTNER_NAV = [{ href: "/portal", label: "Requirements", icon: ListChecks }, { href: "/partner-portal", label: "Partner portal", icon: Handshake }, { href: "/settings/security", label: "Security", icon: ShieldCheck }];
const MEMBER_NAV = [{ href: "/member", label: "My network profile", icon: BadgeCheck }, { href: "/member?tab=opportunities", label: "Opportunities", icon: Briefcase }, { href: "/member?tab=refer", label: "Invite and refer", icon: UserPlus }, { href: "/member?tab=privacy", label: "Privacy & data", icon: Lock }, { href: "/settings/security", label: "Security", icon: ShieldCheck }];
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
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-full px-4 h-11 lg:h-9 text-[14px] lg:text-[13.5px] transition-[background-color,color] duration-200",
          active ? "bg-navy text-white font-semibold dark:text-canvas" : "text-rail-ink font-medium hover:bg-rail-active hover:text-rail-ink-strong",
        )}
      >
        <Icon className="h-[17px] w-[17px] flex-none" />
        <span className="flex-1 truncate">{label}</span>
      </Link>
    );
  };
  const Group = ({ label }: { label: string }) => <div className="px-4 pt-5 pb-1.5 text-[12px] text-ink-faint">{label}</div>;
  const home = restricted ? (user.role === "PARTNER" ? "/partner-portal" : user.role === "MEMBER" ? "/member" : "/client-workspace") : "/overview";
  const openSearch = () => { setOpen(false); window.dispatchEvent(new CustomEvent("ni:open-palette")); };

  return (
    <>
    {open ? <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-ink/35 lg:hidden cursor-default" /> : null}
    {/* A floating white panel: brand, search, the menu, and one prompt to use the agent. */}
    <aside id="app-nav" className={cn("rail flex flex-col flex-none bg-surface text-rail-ink fixed inset-y-0 left-0 z-40 w-[284px] max-w-[88vw] transition-[transform,visibility] duration-200 ease-out lg:sticky lg:top-3 lg:z-auto lg:m-3 lg:mr-0 lg:h-[calc(100dvh-24px)] lg:w-[264px] lg:translate-x-0 lg:visible lg:rounded-[28px] lg:border lg:border-line lg:shadow-[var(--shadow-card)]", open ? "translate-x-0 visible shadow-[var(--shadow-drawer)]" : "-translate-x-full invisible")}>
      <div className="px-5 pt-6 pb-4">
        <Link href={home} className="flex items-center gap-3">
          <BrandMark className="h-[22px] w-auto flex-none text-rail-ink-strong" />
          <span className="leading-[1.15] min-w-0">
            <span className="block font-display is-small text-[15px] text-rail-ink-strong truncate">Network Intelligence</span>
            <span className="block text-[12px] text-ink-faint truncate">{user.tenantName}</span>
          </span>
        </Link>
      </div>
      <div className="px-3 pb-2">
        <button type="button" onClick={openSearch} className="flex h-10 w-full items-center gap-2.5 rounded-full bg-surface-muted pl-4 pr-1.5 text-[13.5px] text-ink-faint transition-colors duration-200 hover:bg-navy-50 cursor-pointer">
          <Search className="h-4 w-4 flex-none" />
          <span className="flex-1 text-left">Search for…</span>
          <span className="rounded-full bg-navy px-2.5 py-1 text-[11px] font-semibold text-white dark:text-canvas">⌘K</span>
        </button>
      </div>
      <nav className="px-3 flex-1 space-y-0.5 overflow-y-auto pt-2 pb-4">
        {restricted ? (user.role === "PARTNER" ? PARTNER_NAV : user.role === "MEMBER" ? MEMBER_NAV : CLIENT_NAV).map((i) => <Item key={i.href} {...i} />) : (
          <>
            {INTERNAL_NAV.map((i) => <Item key={i.href} {...i} />)}
            {SHOW_PHASE23 ? <><Group label="Workspaces" />{WORKSPACES.map((i) => <Item key={i.href} {...i} />)}</> : null}
            <Group label="Setup" />
            {SETTINGS_NAV.filter((i) => i.href !== "/settings/commercials" || user.role === "OWNER").map((i) => <Item key={i.href} {...i} />)}
          </>
        )}
      </nav>
      {!restricted ? (
        <div className="brand-panel m-3 mt-0 rounded-[22px] p-4">
          <div className="font-display is-small text-[14.5px] leading-[1.3]">Ask your network anything</div>
          <p className="text-[12.5px] text-stage-muted leading-[1.45] mt-1">One question, answered from people you know, ranked by trust.</p>
          <button type="button" onClick={openSearch} className="mt-3 inline-flex h-8 items-center btn-coral rounded-full bg-coral px-3.5 text-[12.5px] font-semibold text-[#0c1b33] transition-[filter] duration-200 hover:brightness-105 cursor-pointer">Ask now</button>
        </div>
      ) : null}
    </aside>
    </>
  );
}
