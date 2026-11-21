import { LayoutDashboard, Users, MessagesSquare, Briefcase, Building2, Settings2 } from "lucide-react";
import type { Role } from "@prisma/client";

/**
 * The app's map. Six places in the side menu; the pages inside each one are the tabs across the
 * top. A page belongs to the section whose tab has the longest matching address, so a person's
 * profile sits under Network › People without being listed anywhere.
 */
export type NavPage = { href: string; label: string; ownerOnly?: boolean };
export type NavSection = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; pages: NavPage[]; phase23?: boolean };

const SHOW_PHASE23 = process.env.NEXT_PUBLIC_FEATURE_PHASE23 !== "false";

const SECTIONS: NavSection[] = [
  { key: "home", label: "Home", icon: LayoutDashboard, pages: [{ href: "/overview", label: "Home" }] },
  { key: "network", label: "Network", icon: Users, pages: [{ href: "/network", label: "People" }, { href: "/network/map", label: "Map" }, { href: "/network/availability", label: "Availability" }, { href: "/invite", label: "Grow" }, { href: "/community", label: "Community" }, { href: "/network/import", label: "Import" }] },
  { key: "conversations", label: "Conversations", icon: MessagesSquare, pages: [{ href: "/conversations", label: "Conversations" }] },
  { key: "work", label: "Work", icon: Briefcase, phase23: true, pages: [{ href: "/requirements", label: "Requirements" }, { href: "/opportunities", label: "Opportunities" }, { href: "/referrals", label: "Referrals and pitches" }, { href: "/relocation", label: "Relocation" }] },
  { key: "clients", label: "Clients", icon: Building2, phase23: true, pages: [{ href: "/portal", label: "Client and agency portal" }, { href: "/partners", label: "Agencies" }, { href: "/amana", label: "Amana Expert Network" }] },
  { key: "settings", label: "Settings", icon: Settings2, pages: [{ href: "/settings/screening", label: "Screening" }, { href: "/settings/commercials", label: "Commercials", ownerOnly: true }, { href: "/settings/features", label: "Features", ownerOnly: true }, { href: "/settings/integrations", label: "Integrations" }, { href: "/settings/security", label: "Security" }] },
];

/** The sections and pages this person can see. */
export function sectionsFor(role: Role): NavSection[] {
  // Clients, agencies and members have their own short menu. They get none of the team's sections,
  // not even as tab labels.
  if (role === "CLIENT" || role === "PARTNER" || role === "MEMBER") return [];
  return SECTIONS.filter((s) => SHOW_PHASE23 || !s.phase23).map((s) => ({ ...s, pages: s.pages.filter((p) => !p.ownerOnly || role === "OWNER") }));
}

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** Which section and tab a path belongs to. */
export function locate(pathname: string, sections: NavSection[]): { section: NavSection; page: NavPage } | null {
  let best: { section: NavSection; page: NavPage } | null = null;
  for (const section of sections) for (const page of section.pages) {
    if (matches(pathname, page.href) && (!best || page.href.length > best.page.href.length)) best = { section, page };
  }
  return best;
}
