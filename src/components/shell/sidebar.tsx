"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, MessagesSquare, Briefcase, Building2, Handshake, Plane, Plug, ShieldCheck, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

const INTERNAL_NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/network", label: "Network", icon: Users },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/opportunities", label: "Opportunities", icon: Briefcase },
  { href: "/amana", label: "Amana Expert Network", icon: Building2 },
  { href: "/partners", label: "Partners", icon: Handshake },
  { href: "/relocation", label: "Relocation", icon: Plane },
];

const SETTINGS_NAV = [
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];

const PARTNER_NAV = [
  { href: "/partner-portal", label: "Partner portal", icon: Handshake },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];

const CLIENT_NAV = [
  { href: "/client-workspace", label: "Client workspace", icon: Briefcase },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];

export function Sidebar({ user }: { user: { name: string; email: string; role: Role; tenantName: string } }) {
  const pathname = usePathname();
  const main = user.role === "PARTNER" ? PARTNER_NAV : user.role === "CLIENT" ? CLIENT_NAV : INTERNAL_NAV;
  const settings = user.role === "PARTNER" || user.role === "CLIENT" ? [] : SETTINGS_NAV;

  const Item = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
          active ? "bg-navy-100 text-navy font-medium" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <aside className="w-[232px] shrink-0 border-r border-line bg-surface h-screen sticky top-0 flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-navy text-white text-[11px] font-bold inline-flex items-center justify-center">NI</span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-ink">Network Intelligence</div>
            <div className="text-[11px] text-ink-faint">{user.tenantName}</div>
          </div>
        </div>
      </div>
      <nav className="px-2 py-3 flex-1 space-y-0.5">
        {main.map((i) => <Item key={i.href} {...i} />)}
        {settings.length ? (
          <>
            <div className="px-2.5 pt-4 pb-1 text-[10px] uppercase tracking-wide text-ink-faint">Settings</div>
            {settings.map((i) => <Item key={i.href} {...i} />)}
          </>
        ) : null}
      </nav>
      <div className="px-3 py-3 border-t border-line">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-ink-faint truncate">{user.email}</div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-surface-muted cursor-pointer" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
        <div className="mt-2 text-[10px] text-ink-faint">Press <kbd>⌘</kbd> <kbd>K</kbd> to search</div>
      </div>
    </aside>
  );
}
