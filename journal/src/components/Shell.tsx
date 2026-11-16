"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Ref } from "@/lib/schema";
import { CaptureBox } from "./CaptureBox";
import { logoutAction } from "@/app/actions";
import { QuickTheme } from "./Appearance";
import { Icon, type IconName } from "./Icon";

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/timeline", label: "Timeline", icon: "timeline" },
  { href: "/requests", label: "Requests", icon: "requests" },
  { href: "/decisions", label: "Decisions", icon: "decisions" },
  { href: "/insights", label: "Insights", icon: "insights" },
  { href: "/settings", label: "Appearance", icon: "settings" },
];

interface Props {
  children: ReactNode;
  people: Ref[];
  projects: Ref[];
  tags: string[];
  inboxCount: number;
  mode: "notion" | "demo";
  authed: boolean;
}

export function Shell({ children, people, projects, tags, inboxCount, mode, authed }: Props) {
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
      <aside className="glass sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-3 py-5 md:flex">
        <Link href="/" className="font-display mb-6 flex items-center gap-2 px-2 text-base">
          <span aria-hidden className="brand-mark grid size-7 place-items-center rounded-[calc(var(--radius)*0.6)]"><Icon name="logo" className="size-4" /></span>
          Work Journal
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary mb-4 justify-between">
          <span>+ Capture</span>
          <kbd className="opacity-80">C</kbd>
        </button>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-[calc(var(--radius)*0.6)] px-2.5 py-2 text-sm transition ${
                active(n.href) ? "bg-accent-soft font-medium text-accent-fg" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon name={n.icon} className="size-[1.05rem] opacity-90" />
              {n.label}
              {n.href === "/review" && inboxCount > 0 && (
                <span className="num ml-auto rounded-md bg-accent-soft px-1.5 text-[0.7rem] font-medium text-accent-fg ring-1 ring-accent/30">{inboxCount}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 px-2 text-xs text-ink-3">
          <QuickTheme />
          {mode === "demo" ? (
            <p className="rounded-lg bg-warn/12 p-2 text-warn">Demo mode: sample data, not saved. Add NOTION_TOKEN to connect.</p>
          ) : (
            <p>
              <span className="mr-1 inline-block size-1.5 rounded-full bg-ok align-middle" /> Synced with Notion
            </p>
          )}
          {authed && (
            <form action={logoutAction}>
              <button className="hover:text-ink">Sign out</button>
            </form>
          )}
        </div>
      </aside>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <Link href="/" className="font-display flex items-center gap-2 text-base">
            <span aria-hidden className="brand-mark grid size-7 place-items-center rounded-[calc(var(--radius)*0.6)]"><Icon name="logo" className="size-4" /></span>
            Work Journal
          </Link>
          <Link href="/settings" aria-label="Appearance" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"><Icon name="settings" className="size-5" /></Link>
        </div>
        {mode === "demo" && (
          <p className="mb-4 rounded-lg bg-warn/12 px-3 py-2 text-xs text-warn md:hidden">Demo mode: sample data, not saved to Notion.</p>
        )}
        {children}
      </main>

      {/* Mobile: bottom tabs and a capture button */}
      <nav aria-label="Main" className="glass fixed inset-x-0 bottom-0 z-30 flex border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((n) => n.href !== "/decisions" && n.href !== "/settings").map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] ${active(n.href) ? "text-accent-fg" : "text-ink-3"}`}
          >
            <Icon name={n.icon} className="size-5" />
            {n.label}
            {n.href === "/review" && inboxCount > 0 && (
              <span className="num absolute top-1 right-[24%] rounded-full bg-accent px-1 text-[0.6rem] font-semibold text-accent-ink">{inboxCount}</span>
            )}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Capture"
        className="brand-mark fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full text-2xl shadow-lg md:hidden"
      >
        <Icon name="plus" className="size-6" />
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Capture" className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <CaptureBox people={people} projects={projects} tags={tags} autoFocus onSaved={() => setTimeout(() => setOpen(false), 500)} />
            <p className="mt-2 text-center text-xs text-white/80">Enter to save · Esc to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
