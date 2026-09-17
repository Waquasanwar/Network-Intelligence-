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
          "relative flex items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] transition-colors",
          active ? "bg-surface text-ink font-medium shadow-[0_1px_2px_rgba(16,24,40,0.06),0_0_0_1px_rgba(16,24,40,0.05)]" : "text-ink-muted hover:bg-surface/70 hover:text-ink",
        )}
      >
        <Icon className={cn("h-[15px] w-[15px]", active ? "text-navy" : "text-ink-faint")} />
        {label}
      </Link>
    );
  };
  const Group = ({ label }: { label: string }) => <div className="px-2.5 pt-4 pb-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">{label}</div>;

  return (
    <aside className="w-[224px] flex-none border-r border-line bg-surface-muted/70 h-screen sticky top-0 flex flex-col">
      <div className="px-3.5 pt-4 pb-3">
        <Link href={restricted ? (user.role === "PARTNER" ? "/partner-portal" : "/client-workspace") : "/overview"} className="flex items-center gap-2.5">
          <span className="h-7 w-7 rounded-[7px] bg-navy text-white text-[11px] font-semibold inline-flex items-center justify-center tracking-tight">NI</span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-ink">Network Intelligence</span>
            <span className="block text-[11px] text-ink-faint">{user.tenantName}</span>
          </span>
        </Link>
      </div>
      <nav className="px-2 flex-1 space-y-px overflow-y-auto">
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
      <div className="px-3 py-3 border-t border-line">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-7 w-7 rounded-full bg-navy-100 text-navy text-[11px] font-semibold inline-flex items-center justify-center flex-none">{user.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
            <div className="min-w-0 leading-tight">
              <div className="text-[12.5px] font-medium truncate">{user.name}</div>
              <div className="text-[11px] text-ink-faint truncate capitalize">{user.role.toLowerCase()}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-surface cursor-pointer" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </aside>
  );
}
