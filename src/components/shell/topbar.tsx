"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import * as React from "react";

const NAMES: Record<string, string> = {
  overview: "Overview", network: "Network", import: "Import contacts", conversations: "Conversations", opportunities: "Opportunities", amana: "Amana Expert Network",
  partners: "Partners", relocation: "Relocation", settings: "Settings", integrations: "Integrations", security: "Security", "partner-portal": "Partner portal", "client-workspace": "Client workspace", requirements: "Requirements", portal: "Client & agency portal", commercials: "Commercials", referrals: "Referrals & pitches", member: "My network profile", screening: "Screening", join: "Join the network",
};

export type Alert = { kind: string; text: string; href: string; when: string; tone: "teal" | "amber" | "navy" };

export function TopBar({ crumbs, alerts = [] }: { crumbs?: { label: string; href?: string }[]; alerts?: Alert[] }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const NO_PAGE = new Set(["settings"]);
  const auto = parts.map((p, i) => ({ label: NAMES[p] ?? (i === parts.length - 1 ? "Detail" : p), href: NO_PAGE.has(p) ? undefined : "/" + parts.slice(0, i + 1).join("/") }));
  const [docTitle, setDocTitle] = React.useState<string | null>(null);
  React.useEffect(() => {
    const t = document.title.split(" · ")[0];
    setDocTitle(t && t !== "Network Intelligence" ? t : null);
  }, [pathname]);
  const items = (crumbs ?? auto).map((c, i, arr) => (i === arr.length - 1 && c.label === "Detail" && docTitle ? { ...c, label: docTitle } : c));
  return (
    <header className="h-14 flex items-center justify-between gap-4 px-7 sticky top-0 z-20 glass border-b border-line">
      <nav className="flex items-center gap-1.5 text-[12.5px] text-ink-muted min-w-0" aria-label="Breadcrumb">
        {items.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 ? <span className="text-ink-faint/60">/</span> : null}
            {i < items.length - 1 && c.href ? <Link href={c.href} className="hover:text-ink truncate">{c.label}</Link> : <span className="text-ink font-medium truncate">{c.label}</span>}
          </span>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("ni:open-palette"))}
        className="group flex items-center gap-2 h-9 w-[320px] max-w-[40vw] rounded-full border border-line bg-surface/80 px-3.5 text-[12.5px] text-ink-faint hover:border-line-strong hover:bg-surface transition-all cursor-text shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search people, opportunities…</span>
        <span className="flex items-center gap-0.5"><kbd>⌘</kbd><kbd>K</kbd></span>
      </button>
      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Alerts" className="relative h-9 w-9 rounded-full border border-line bg-surface/80 grid place-items-center text-ink-muted hover:text-ink hover:border-line-strong">
          <Bell className="h-4 w-4" />
          {alerts.length ? <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber text-[#1a1200] text-[10.5px] font-semibold leading-[18px] text-center ring-2 ring-canvas">{alerts.length}</span> : null}
        </button>
        {open ? (
          <div className="absolute right-0 top-11 z-30 w-[380px] max-w-[calc(100vw-32px)] rounded-[18px] border border-line bg-surface shadow-[var(--shadow-drawer)] overflow-hidden anim-fade">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line text-[13px]"><b>Needs your attention</b><small className="text-ink-faint">{alerts.length} item{alerts.length === 1 ? "" : "s"}</small></div>
            {alerts.length ? <ul className="p-1.5 max-h-[60vh] overflow-auto">{alerts.map((a, i) => <li key={i}><Link href={a.href} onClick={() => setOpen(false)} className="grid grid-cols-[auto_1fr_auto] gap-2.5 items-center px-2.5 py-2 rounded-[12px] text-[12.5px] hover:bg-surface-muted"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${a.tone === "teal" ? "bg-teal-100 text-teal" : a.tone === "amber" ? "bg-amber-100 text-amber" : "bg-navy-100 text-navy"}`}>{a.kind}</span><span>{a.text}</span><small className="text-ink-faint whitespace-nowrap">{a.when}</small></Link></li>)}</ul> : <p className="px-4 py-3.5 text-[12.5px] text-ink-muted">Nothing waiting. New registrations, screenings, referrals, pitches and client requests appear here.</p>}
          </div>
        ) : null}
      </div>
    </header>
  );
}
