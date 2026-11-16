"use client";
import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The actions that do not earn a place on the page. One button, a short menu. The items stay
 * mounted while the menu is closed, so a drawer opened from here keeps working after it shuts.
 */
export function MoreMenu({ children, label = "More", align = "right" }: { children: React.ReactNode; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink transition-colors duration-200 hover:border-ink cursor-pointer">
        <MoreHorizontal className="h-4 w-4" /> {label}
      </button>
      <div role="menu" hidden={!open} onClick={() => setOpen(false)} className={cn("more-menu absolute top-11 z-30 min-w-[220px] rounded-[22px] border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]", align === "right" ? "right-0" : "left-0")}>
        {children}
      </div>
    </div>
  );
}
