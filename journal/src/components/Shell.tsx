"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Ref } from "@/lib/schema";
import { CaptureBox } from "./CaptureBox";
import { logoutAction } from "@/app/actions";
import { QuickTheme } from "./Appearance";
import { Icon, type IconName } from "./Icon";

// Each binder section has its own index-tab colour; the page you are on takes that colour.
const NAV: Array<{ href: string; label: string; icon: IconName; color: string }> = [
  { href: "/", label: "Today", icon: "today", color: "#1c6fd6" },
  { href: "/plan", label: "Plan", icon: "plan", color: "#7b52e8" },
  { href: "/projects", label: "Projects", icon: "projects", color: "#0f9a86" },
  { href: "/review", label: "Review", icon: "review", color: "#e09a12" },
  { href: "/requests", label: "Requests", icon: "requests", color: "#e8573a" },
  { href: "/procurement", label: "Procurement", icon: "procurement", color: "#3a9d4a" },
  { href: "/decisions", label: "Decisions", icon: "decisions", color: "#b2449c" },
  { href: "/timeline", label: "Timeline", icon: "timeline", color: "#2196c9" },
  { href: "/insights", label: "Insights", icon: "insights", color: "#5458dc" },
  { href: "/settings", label: "Appearance", icon: "settings", color: "#6b7480" },
];

export function sectionColor(path: string): string {
  const hit = [...NAV].reverse().find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)));
  if (path.startsWith("/entry")) return "#1c6fd6";
  if (path.startsWith("/start")) return "#0f9a86";
  return hit?.color ?? "#1c6fd6";
}

interface Props {
  children: ReactNode;
  people: Ref[];
  projects: Ref[];
  tags: string[];
  inboxCount: number;
  mode: "notion" | "demo";
  authed: boolean;
  setupDone: number;
  setupTotal: number;
}

export function Shell({ children, people, projects, tags, inboxCount, mode, authed, setupDone, setupTotal }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "c" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setOpen(false), [path]);

  if (path === "/login") return <>{children}</>;

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-dvh md:flex">
      {/* The binder spine: graphite, with index tabs. The current page's tab is cut from the page. */}
      <aside className="spine sticky top-0 z-10 hidden h-dvh w-60 shrink-0 flex-col py-5 pl-3 text-spine-ink md:flex">
        <Link href="/" className="mb-5 flex items-center gap-2.5 px-2.5">
          <span aria-hidden className="spine-logo grid size-7 place-items-center rounded-[var(--radius)]">
            <Icon name="logo" className="size-4" />
          </span>
          <span className="font-display text-[1.05rem] tracking-wide uppercase">Work Journal</span>
        </Link>
        <div className="pr-3">
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary mb-5 w-full justify-between">
            <span>New entry</span>
            <kbd className="opacity-80">C</kbd>
          </button>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className="tab" style={{ ["--tab" as string]: n.color }}>
              <Icon name={n.icon} className="size-[1.05rem] shrink-0" />
              {n.label}
              {!(n.href === "/review" && inboxCount > 0) && <span className="tab-mark ml-auto" />}
              {n.href === "/review" && inboxCount > 0 && <span className="num ml-auto text-[0.72rem] opacity-80">{inboxCount}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 pr-3 pl-2.5 text-xs text-spine-ink-2">
          <div className="spine-divider" />
          <Link href="/start" aria-current={active("/start") ? "page" : undefined} className="flex items-center justify-between rounded-[var(--radius)] px-1 py-1 text-spine-ink hover:text-white">
            <span className="flex items-center gap-2"><Icon name="rocket" className="size-4" /> Get started</span>
            <span className={`num text-[0.7rem] ${setupDone === setupTotal ? "text-ok" : "text-warn"}`}>{setupDone}/{setupTotal}</span>
          </Link>
          <QuickTheme />
          <p className="flex items-start gap-2 leading-snug">
            <span className={`mt-1 size-1.5 shrink-0 rounded-full ${mode === "demo" ? "bg-warn" : "bg-ok"}`} />
            {mode === "demo" ? "Sample data, not saved. Add NOTION_TOKEN to connect your Notion." : "Saving to Notion"}
          </p>
          {authed && (
            <form action={logoutAction}>
              <button className="hover:text-spine-ink">Sign out</button>
            </form>
          )}
        </div>
      </aside>

      <main className="section-wash w-full flex-1" style={{ ["--section" as string]: sectionColor(path) }}>
       <div className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:px-10 md:pt-9 md:pb-12">
        <div className="spine -mx-4 -mt-4 mb-5 flex items-center justify-between px-4 py-3 text-spine-ink md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden className="spine-logo grid size-7 place-items-center rounded-[var(--radius)]">
              <Icon name="logo" className="size-4" />
            </span>
            <span className="font-display tracking-wide uppercase">Work Journal</span>
          </Link>
          <Link href="/settings" aria-label="Appearance" className="grid size-9 place-items-center rounded-[var(--radius)] text-spine-ink-2 hover:text-spine-ink">
            <Icon name="settings" className="size-5" />
          </Link>
        </div>
        {setupDone < setupTotal && path !== "/start" && (
          <Link href="/start" className="mb-4 flex items-center justify-between rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-xs text-ink-2 md:hidden">
            <span>{mode === "demo" ? "Sample data. Finish setting up to use your Notion." : "Finish setting up"}</span>
            <span className="num text-warn">{setupDone}/{setupTotal} →</span>
          </Link>
        )}
        {children}
       </div>
      </main>

      {/* Phone: bottom tabs and a new-entry button */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((n) => ["/", "/plan", "/projects", "/requests", "/insights"].includes(n.href)).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] ${active(n.href) ? "text-accent-fg" : "text-ink-3"}`}
          >
            {active(n.href) && <span className="absolute top-0 h-0.5 w-8 rounded-b" style={{ background: n.color }} />}
            <Icon name={n.icon} className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="New entry"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_4px_14px_rgb(31_36_41/25%)] md:hidden"
      >
        <Icon name="plus" className="size-6" />
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="New entry" className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(31_36_41/55%)] px-3 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <CaptureBox people={people} projects={projects} tags={tags} autoFocus onSaved={() => setTimeout(() => setOpen(false), 500)} />
            <p className="mt-2 text-center text-xs text-white/85">Enter to save · Esc to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
