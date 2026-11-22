"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, UsersRound, Briefcase, Menu, MessageCircle, UserRound, ListChecks, Search, ShieldCheck, Lock } from "lucide-react";
import { AgentMark } from "@/components/ui/agent-mark";
import { cn } from "@/lib/utils";
import type { Released } from "./sidebar";

type Item = { href: string; label: string; icon: typeof Home };
type Core = { label: string; href?: string; event?: string };

/**
 * On a phone, everything sits round one centre: the Amana core in the middle of the bar. For the
 * team it asks the network; for a member it is where they tell Amana who they know; for a client it
 * raises a need. Four quiet places either side, only those that are released, and the full menu.
 */
export function CoreBar({ role, internal, released }: { role: string; internal: boolean; released: Released }) {
  const pathname = usePathname(); const sp = useSearchParams();
  const here = `${pathname}${sp.get("tab") ? `?tab=${sp.get("tab")}` : ""}`;
  let left: Item[], right: Item[], core: Core;
  if (internal) {
    left = [{ href: "/overview", label: "Home", icon: Home }, { href: "/network", label: "Network", icon: UsersRound }];
    right = [{ href: "/requirements", label: "Work", icon: Briefcase }];
    core = { label: "Ask", event: "ni:open-palette" };
  } else if (role === "MEMBER") {
    left = [{ href: "/member", label: "Home", icon: Home }, released.connections ? { href: "/community?tab=connections", label: "Messages", icon: MessageCircle } : { href: "/member?tab=privacy", label: "Privacy", icon: Lock }];
    right = [released.home ? { href: "/member?tab=profile", label: "Profile", icon: UserRound } : { href: "/settings/security", label: "Security", icon: ShieldCheck }];
    core = released.referrals ? { label: "Refer", href: "/member?tab=refer" } : { label: "Amana", href: "/member" };
  } else {
    const home = role === "PARTNER" ? "/partner-portal" : "/portal";
    left = [{ href: home, label: role === "PARTNER" ? "Portal" : "Needs", icon: ListChecks }, released.portal ? { href: "/portal/search", label: "Search", icon: Search } : { href: "/settings/security", label: "Security", icon: ShieldCheck }];
    right = [{ href: "/settings/security", label: "Security", icon: ShieldCheck }].filter((i) => !left.some((l) => l.href === i.href));
    core = released.portal ? { label: "Raise", href: "/portal#raise" } : { label: "Amana", href: home };
  }
  const on = (href: string) => (href.includes("?") ? here === href : pathname === href && !sp.get("tab"));
  const tab = (i: Item) => (
    <Link key={i.href} href={i.href} className={cn("core-tab", on(i.href) && "is-on")} aria-current={on(i.href) ? "page" : undefined}>
      <i.icon className="h-[20px] w-[20px]" aria-hidden="true" strokeWidth={on(i.href) ? 2.2 : 1.8} /><span>{i.label}</span>
    </Link>
  );
  const coreInner = <><span className="core-orb" aria-hidden="true"><AgentMark size={22} /></span><span className="core-label">{core.label}</span></>;
  return (
    <nav className="core-bar lg:hidden" aria-label="Main" data-core-bar>
      <div className="core-row">
        {left.map(tab)}
        {core.event
          ? <button type="button" className="core-btn" onClick={() => window.dispatchEvent(new CustomEvent(core.event!))} aria-label={`${core.label}: Amana`}>{coreInner}</button>
          : <Link href={core.href!} className="core-btn" aria-label={`${core.label}: Amana`}>{coreInner}</Link>}
        {right.map(tab)}
        <button type="button" className="core-tab" onClick={() => window.dispatchEvent(new CustomEvent("ni:toggle-nav"))} aria-label="Open the menu" aria-controls="app-nav">
          <Menu className="h-[20px] w-[20px]" aria-hidden="true" strokeWidth={1.8} /><span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
