"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

const NAMES: Record<string, string> = {
  overview: "Overview", network: "Network", import: "Import contacts", conversations: "Conversations", opportunities: "Opportunities", amana: "Amana Expert Network",
  partners: "Partners", relocation: "Relocation", settings: "Settings", integrations: "Integrations", security: "Security", "partner-portal": "Partner portal", "client-workspace": "Client workspace",
};

export function TopBar({ crumbs }: { crumbs?: { label: string; href?: string }[] }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const NO_PAGE = new Set(["settings"]);
  const auto = parts.map((p, i) => ({ label: NAMES[p] ?? (i === parts.length - 1 ? "Detail" : p), href: NO_PAGE.has(p) ? undefined : "/" + parts.slice(0, i + 1).join("/") }));
  const items = crumbs ?? auto;
  return (
    <header className="h-12 flex items-center justify-between gap-4 px-6 border-b border-line bg-canvas/80 backdrop-blur sticky top-0 z-20">
      <nav className="flex items-center gap-1.5 text-[12.5px] text-ink-muted min-w-0" aria-label="Breadcrumb">
        {items.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 ? <span className="text-line-strong">/</span> : null}
            {i < items.length - 1 && c.href ? <Link href={c.href} className="hover:text-ink truncate">{c.label}</Link> : <span className="text-ink font-medium truncate">{c.label}</span>}
          </span>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("ni:open-palette"))}
        className="group flex items-center gap-2 h-8 w-[300px] max-w-[40vw] rounded-md border border-line bg-surface px-2.5 text-[12.5px] text-ink-faint hover:border-line-strong transition-colors cursor-text"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search people, opportunities…</span>
        <span className="flex items-center gap-0.5"><kbd>⌘</kbd><kbd>K</kbd></span>
      </button>
    </header>
  );
}
