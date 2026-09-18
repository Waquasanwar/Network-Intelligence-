"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, MessagesSquare, Briefcase, Building2, Handshake, Plane, Plug, ShieldCheck, LogOut, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

const INTERNAL_NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/network", label: "Network", icon: Users },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/opportunities", label: "Opportunities", icon: Briefcase },
];
const WORKSPACES = [
  { href: "/amana", label: "Amana Expert Network", icon: Building2 },
  { href: "/partners", label: "Partners", icon: Handshake },
  { href: "/relocation", label: "Relocation", icon: Plane },
];
const SETTINGS_NAV = [
  { href: "/network/import", label: "Import contacts", icon: Upload },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];
const PARTNER_NAV = [{ href: "/partner-portal", label: "Partner portal", icon: Handshake }, { href: "/settings/security", label: "Security", icon: ShieldCheck }];
const CLIENT_NAV = [{ href: "/client-workspace", label: "Client workspace", icon: Briefcase }, { href: "/settings/security", label: "Security", icon: ShieldCheck }];

export function Sidebar({ user }: { user: { name: string; email: string; role: Role; tenantName: string } }) {
  const pathname = usePathname();
  const restricted = user.role === "PARTNER" || user.role === "CLIENT";

  const Item = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const active = href === "/network" ? pathname === "/network" || (pathname.startsWith("/network/") && !pathname.startsWith("/network/import")) : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[13px] transition-colors",
          active ? "bg-rail-active text-rail-ink-strong font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-rail-ink hover:bg-white/5 hover:text-rail-ink-strong",
        )}
      >
        {active ? <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-teal-400" /> : null}
        <Icon className={cn("h-[15px] w-[15px] transition-colors", active ? "text-teal-400" : "text-white/45 group-hover:text-white/70")} />
        {label}
      </Link>
    );
  };
  const Group = ({ label }: { label: string }) => <div className="px-2.5 pt-5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/35">{label}</div>;

  return (
    <aside className="w-[232px] flex-none bg-rail h-screen sticky top-0 flex flex-col text-rail-ink">
      <div className="px-4 pt-5 pb-4">
        <Link href={restricted ? (user.role === "PARTNER" ? "/partner-portal" : "/client-workspace") : "/overview"} className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-[9px] bg-gradient-to-br from-white/20 to-white/5 text-white text-[11.5px] font-semibold inline-flex items-center justify-center tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/10">NI</span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-white">Network Intelligence</span>
            <span className="block text-[11px] text-white/45">{user.tenantName}</span>
          </span>
        </Link>
      </div>
      <nav className="px-2.5 flex-1 space-y-0.5 overflow-y-auto">
        {restricted ? (user.role === "PARTNER" ? PARTNER_NAV : CLIENT_NAV).map((i) => <Item key={i.href} {...i} />) : (
          <>
            {INTERNAL_NAV.map((i) => <Item key={i.href} {...i} />)}
            <Group label="Workspaces" />
            {WORKSPACES.map((i) => <Item key={i.href} {...i} />)}
            <Group label="Setup" />
            {SETTINGS_NAV.map((i) => <Item key={i.href} {...i} />)}
          </>
        )}
      </nav>
      <div className="m-2.5 mt-0 rounded-[12px] bg-white/5 ring-1 ring-white/8 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-400 to-navy-400 text-white text-[11px] font-semibold inline-flex items-center justify-center flex-none">{user.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
            <div className="min-w-0 leading-tight">
              <div className="text-[12.5px] font-medium text-white truncate">{user.name}</div>
              <div className="text-[11px] text-white/45 truncate capitalize">{user.role.toLowerCase()}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/10 cursor-pointer" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </aside>
  );
}
