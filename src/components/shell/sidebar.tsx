"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, MessagesSquare, Briefcase, Building2, Handshake, Plane, Plug, ShieldCheck, LogOut, Upload, ListChecks, MonitorSmartphone, Percent, UserPlus, BadgeCheck, Link2, MicVocal, Lock } from "lucide-react";
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
          "group relative flex items-center gap-3 rounded-full pl-3.5 pr-3 py-[11px] lg:py-[8.5px] text-[14px] lg:text-[13.5px] transition-[background-color,color,box-shadow] duration-200",
          active ? "bg-rail-active text-rail-ink-strong font-semibold shadow-[var(--shadow-card)] ring-1 ring-rail-line" : "text-rail-ink font-medium hover:bg-rail-active/70 hover:text-rail-ink-strong",
        )}
      >
        <Icon className={cn("h-4 w-4 flex-none transition-colors", active ? "text-rail-ink-strong" : "text-rail-ink group-hover:text-rail-ink-strong")} />
        <span className="flex-1 truncate">{label}</span>
        {active ? <span aria-hidden="true" className="h-[9px] w-[9px] flex-none rounded-[2px] bg-accent" /> : null}
      </Link>
    );
  };
  const Group = ({ label }: { label: string }) => <div className="px-3.5 pt-6 pb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</div>;

  return (
    <>
    {open ? <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-ink/35 lg:hidden cursor-default" /> : null}
    <aside id="app-nav" className={cn("rail-surface flex flex-col text-rail-ink h-dvh flex-none fixed inset-y-0 left-0 z-40 w-[272px] max-w-[86vw] transition-[transform,visibility] duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:w-[248px] lg:translate-x-0 lg:visible", open ? "translate-x-0 visible shadow-[var(--shadow-drawer)] lg:shadow-none" : "-translate-x-full invisible")}>
      <div className="px-5 pt-6 pb-5">
        <Link href={restricted ? (user.role === "PARTNER" ? "/partner-portal" : user.role === "MEMBER" ? "/member" : "/client-workspace") : "/overview"} className="flex items-center gap-3">
          <BrandMark className="h-[26px] w-auto flex-none text-rail-ink-strong" />
          <span className="leading-[1.1]">
            <span className="block font-display is-small text-[16px] text-rail-ink-strong">Network Intelligence</span>
            <span className="block text-[11.5px] text-rail-ink mt-0.5">{user.tenantName}</span>
          </span>
        </Link>
      </div>
      <nav className="px-3 flex-1 space-y-0.5 overflow-y-auto py-1">
        {restricted ? (user.role === "PARTNER" ? PARTNER_NAV : user.role === "MEMBER" ? MEMBER_NAV : CLIENT_NAV).map((i) => <Item key={i.href} {...i} />) : (
          <>
            {INTERNAL_NAV.map((i) => <Item key={i.href} {...i} />)}
            {SHOW_PHASE23 ? <><Group label="Workspaces" />{WORKSPACES.map((i) => <Item key={i.href} {...i} />)}</> : null}
            <Group label="Setup" />
            {SETTINGS_NAV.map((i) => <Item key={i.href} {...i} />)}
          </>
        )}
      </nav>
      <div className="m-3 mt-2 rounded-[16px] bg-surface ring-1 ring-rail-line shadow-[var(--shadow-card)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-8 w-8 rounded-full bg-accent text-accent-ink text-[11.5px] font-bold inline-flex items-center justify-center flex-none">{user.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
            <div className="min-w-0 leading-tight">
              <div className="text-[12.5px] font-medium text-rail-ink-strong truncate">{user.name}</div>
              <div className="text-[11px] text-rail-ink truncate capitalize">{user.role.toLowerCase()}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="p-1.5 rounded-md text-rail-ink hover:text-rail-ink-strong hover:bg-rail-active cursor-pointer" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </aside>
    </>
  );
}
