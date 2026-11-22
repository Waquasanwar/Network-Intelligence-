"use client";
import { signOutAction } from "@/server/actions/session";
import { markNotesSeen } from "@/server/actions/agent-notes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, ChevronRight, ChevronDown, LogOut } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import * as React from "react";
import type { Role } from "@prisma/client";
import { sectionsFor, locate } from "./nav";

const NAMES: Record<string, string> = {
  overview: "Overview", network: "Network", import: "Import contacts", conversations: "Conversations", opportunities: "Opportunities", amana: "Amana Expert Network",
  partners: "Partners", relocation: "Relocation", settings: "Settings", integrations: "Integrations", security: "Security", "partner-portal": "Partner portal", "client-workspace": "Client workspace", requirements: "Requirements", portal: "Client & agency portal", commercials: "Commercials", referrals: "Referrals & pitches", member: "My network profile", screening: "Screening", join: "Join the network",
};

/**
 * The pages inside the current section, as tabs. The side menu says where you are; these say what
 * else is here. Sections with a single page show nothing.
 */
export function SectionTabs({ role, className = "" }: { role: string; className?: string }) {
  const pathname = usePathname();
  const here = locate(pathname, sectionsFor(role as Role));
  if (!here || here.section.pages.length < 2) return null;
  return (
    <nav aria-label={here.section.label} className={`max-w-full overflow-x-auto ${className}`}>
      <ul className="inline-flex items-center gap-1">
        {here.section.pages.map((pg) => { const active = pg.href === here.page.href; return (
          <li key={pg.href}><Link href={pg.href} aria-current={active ? "page" : undefined} className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] transition-colors duration-200 ${active ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "font-medium text-ink-muted hover:text-ink"}`}>{pg.label}</Link></li>
        ); })}
      </ul>
    </nav>
  );
}

/** A thing waiting on you, or something the agent has told you. `unread: false` is a note already seen. */
export type Alert = { kind: string; text: string; href: string; when: string; tone: "teal" | "amber" | "navy"; unread?: boolean };

function useCrumbs(crumbs?: { label: string; href?: string }[]) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const NO_PAGE = new Set(["settings"]);
  const auto = parts.map((p, i) => ({ label: NAMES[p] ?? (i === parts.length - 1 ? "Detail" : p), href: NO_PAGE.has(p) ? undefined : "/" + parts.slice(0, i + 1).join("/") }));
  const [docTitle, setDocTitle] = React.useState<string | null>(null);
  React.useEffect(() => {
    const t = document.title.split(" · ")[0];
    setDocTitle(t && t !== APP_NAME ? t : null);
  }, [pathname]);
  return (crumbs ?? auto).map((c, i, arr) => (i === arr.length - 1 && c.label === "Detail" && docTitle ? { ...c, label: docTitle } : c));
}

/** Where you are, shown above the page title once you are more than one level deep. */
export function Crumbs({ crumbs }: { crumbs?: { label: string; href?: string }[] }) {
  const items = useCrumbs(crumbs);
  if (items.length < 2) return null;
  return (
    <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] text-ink-muted min-w-0" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          {i > 0 ? <ChevronRight className="h-3 w-3 flex-none text-ink-faint" aria-hidden="true" /> : null}
          {i < items.length - 1 && c.href ? <Link href={c.href} className="inline-block py-1 hover:text-ink hover:underline underline-offset-4 truncate">{c.label}</Link> : <span className="text-ink font-medium truncate">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/**
 * The platform bar: one dark strip across the top of every screen. Brand on the left, search in the
 * middle, alerts and your account on the right — the same place on every page.
 */
export function TopBar({ alerts = [], user, home }: { alerts?: Alert[]; user: { name: string; role: string; tenantName: string }; home: string }) {
  const [open, setOpen] = React.useState<"alerts" | "account" | null>(null);
  const waiting = alerts.filter((a) => a.unread !== false).length;
  const pathname = usePathname();
  React.useEffect(() => { setOpen(null); }, [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const initials = user.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="h-[68px] flex-none flex items-center gap-2.5 px-4 sm:px-6 lg:px-8 sticky top-0 z-20 glass">
      <Link href={home} className="lg:hidden flex h-10 flex-none items-center" aria-label="Home"><BrandMark className="h-[20px] w-auto text-ink" /></Link>
      <div className="hidden lg:block min-w-0 flex-1"><SectionTabs role={user.role} /></div>
      <div className="flex-1 lg:hidden" />
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("ni:open-palette"))} aria-label="Search people and opportunities" className="lg:hidden h-10 w-10 flex-none grid place-items-center rounded-full border border-line bg-surface text-ink shadow-[var(--shadow-card)] cursor-pointer">
        <Search className="h-[18px] w-[18px]" />
      </button>
      <ThemeToggle className="h-10 w-10 flex-none" />

      <div className="relative flex-none">
        <button type="button" onClick={() => { if (open !== "alerts" && waiting) void markNotesSeen(); setOpen(open === "alerts" ? null : "alerts"); }} aria-label={`Updates${waiting ? `, ${waiting} new` : ""}`} aria-expanded={open === "alerts"} className="relative h-10 w-10 rounded-full border border-line bg-surface grid place-items-center text-ink shadow-[var(--shadow-card)] hover:border-line-strong transition-colors duration-200 cursor-pointer">
          <Bell className="h-[18px] w-[18px]" />
          {waiting ? <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-coral text-accent-ink text-[10px] font-bold leading-[17px] text-center ring-2 ring-canvas">{waiting}</span> : null}
        </button>
        {open === "alerts" ? (
          <div className="absolute right-0 top-12 z-50 w-[380px] max-w-[calc(100vw-24px)] widget text-ink shadow-[var(--shadow-pop)] overflow-hidden anim-fade">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line text-[13px]"><b>Updates</b><small className="text-ink-faint">{waiting ? `${waiting} new` : "All caught up"}</small></div>
            {alerts.length ? <ul className="p-1.5 max-h-[60vh] overflow-auto">{alerts.map((a, i) => <li key={i}><Link href={a.href} onClick={() => setOpen(null)} className="grid grid-cols-[auto_1fr_auto] gap-2.5 items-center px-2.5 py-2 rounded-[12px] text-[12.5px] hover:bg-surface-muted"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${a.tone === "teal" ? "bg-teal-100 text-teal" : a.tone === "amber" ? "bg-amber-100 text-amber" : "bg-navy-100 text-navy"}`}>{a.kind}</span><span>{a.text}</span><small className="text-ink-faint whitespace-nowrap">{a.when}</small></Link></li>)}</ul> : <p className="px-4 py-3.5 text-[12.5px] text-ink-muted">Nothing waiting. New registrations, screenings, referrals, pitches and client requests appear here.</p>}
          </div>
        ) : null}
      </div>

      <div className="relative flex-none">
        <button type="button" onClick={() => setOpen(open === "account" ? null : "account")} aria-label="Your account" aria-expanded={open === "account"} className="flex items-center gap-2 h-10 rounded-full border border-line bg-surface pl-1 pr-1 sm:pr-3 shadow-[var(--shadow-card)] hover:border-line-strong transition-colors duration-200 cursor-pointer">
          <span className="h-8 w-8 rounded-full bg-accent text-accent-ink text-[11.5px] font-semibold inline-flex items-center justify-center flex-none">{initials}</span>
          <span className="hidden sm:block text-[13px] font-semibold text-ink max-w-[140px] truncate">{user.name}</span>
          <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
        </button>
        {open === "account" ? (
          <div className="absolute right-0 top-12 z-50 w-[250px] widget text-ink shadow-[var(--shadow-pop)] overflow-hidden anim-fade">
            <div className="px-4 py-3 border-b border-line">
              <div className="text-[13px] font-semibold truncate">{user.name}</div>
              <div className="text-[12px] text-ink-muted truncate capitalize">{user.role.toLowerCase()} · {user.tenantName}</div>
            </div>
            <form action={signOutAction} className="p-1.5">
              <button className="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-[13px] text-ink hover:bg-surface-muted cursor-pointer"><LogOut className="h-4 w-4 text-ink-muted" /> Sign out</button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
