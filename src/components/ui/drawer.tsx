"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Right-hand drawer. Quick actions happen here so the page underneath keeps its context. */
export function Drawer({ trigger, title, description, children, width = "md" }: { trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode | ((close: () => void) => React.ReactNode); width?: "md" | "lg" }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const panel = open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-[#0f172a]/30 backdrop-blur-[2px] anim-fade" onClick={close} />
          <div className={cn("absolute right-3 top-3 bottom-3 bg-surface rounded-[18px] shadow-[var(--shadow-drawer)] flex flex-col anim-drawer", width === "lg" ? "w-[760px] max-w-[calc(100vw-16px)]" : "w-[500px] max-w-[calc(100vw-16px)]")} role="dialog" aria-modal="true" aria-label={title}>
            <div className="flex items-start justify-between px-5 py-4 border-b border-line">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
                {description ? <p className="text-[12.5px] text-ink-muted mt-0.5 leading-4 max-w-md">{description}</p> : null}
              </div>
              <Button variant="ghost" size="icon" onClick={close} aria-label="Close"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{typeof children === "function" ? children(close) : children}</div>
          </div>
        </div>
  ) : null;
  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">{trigger}</span>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
