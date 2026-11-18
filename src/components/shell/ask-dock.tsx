"use client";
import * as React from "react";
import { usePathname } from "next/navigation";

/** What is worth asking depends on where you are. */
const ASK: [RegExp, string[]][] = [
  [/^\/network/, ["Who is free now for an interim programme director?", "Who do I know in Dubai with banking experience?", "Who have I delivered with and not spoken to lately?"]],
  [/^\/(requirements|opportunities|referrals|relocation)/, ["Who fits a fractional CISO, two days a week in the UAE?", "Who could start a finance transformation next month?", "Who is open to a permanent role in London?"]],
  [/^\/conversations/, ["Who told me they are open to work?", "Who should I catch up with this week?"]],
  [/^\/(portal|partners|amana)/, ["Who can I put in front of a client this week?", "Who has delivered an SOW with us before?"]],
];
const ANY = ["Who do I trust for a turnaround?", "Who is free now and already in the Gulf?"];

/**
 * Ask from anywhere. A bar that floats over the page and opens the same search as ⌘K, already
 * filled with a question that suits the section. It steps out of the way while you scroll down.
 */
export function AskDock() {
  const pathname = usePathname();
  const list = React.useMemo(() => ASK.find(([re]) => re.test(pathname))?.[1] ?? ANY, [pathname]);
  const [i, setI] = React.useState(0);
  const [away, setAway] = React.useState(false);

  React.useEffect(() => { setI(0); }, [pathname]);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((n) => n + 1), 6000);
    return () => window.clearInterval(t);
  }, []);
  React.useEffect(() => {
    let last = window.scrollY, rest = 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 6 && y > 160) setAway(true); else if (y < last - 6) setAway(false);
      last = y;
      window.clearTimeout(rest); rest = window.setTimeout(() => setAway(false), 1400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.clearTimeout(rest); };
  }, []);

  // While you are filling something in, the bar keeps out of the way of the buttons under your hands.
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    const field = (t: EventTarget | null) => t instanceof HTMLElement && t.matches("input:not([type=checkbox]):not([type=radio]), textarea, select") && !t.closest('[role="dialog"]');
    const on = (e: FocusEvent) => { if (field(e.target)) setEditing(true); };
    const off = (e: FocusEvent) => { if (field(e.target)) setEditing(false); };
    document.addEventListener("focusin", on); document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, []);

  if (pathname === "/overview") return null; // Home has the full composer.
  const q = list[i % list.length];
  return (
    <div className="ask-dock" data-away={away || editing || undefined}>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("ni:open-palette", { detail: { q } }))} aria-label={`Ask your network. For example: ${q}`} className="ask-dock-bar group">
        <span className="beam is-slow" aria-hidden="true" />
        <span className="ai-orb" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 items-baseline gap-2 text-left"><span className="flex-none font-semibold text-ink">Ask</span><span key={q} className="rise-in min-w-0 truncate text-ink-muted">{q}</span></span>
        <kbd className="hidden sm:inline-flex flex-none items-center !rounded-full !px-2">⌘K</kbd>
      </button>
    </div>
  );
}
