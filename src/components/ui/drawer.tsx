"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Right-hand drawer — the platform prefers drawers over page navigation for quick actions. */
export function Drawer({ trigger, title, description, children, width = "md" }: { trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode | ((close: () => void) => React.ReactNode); width?: "md" | "lg" }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">{trigger}</span>
      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/20" onClick={close} />
          <div className={cn("absolute right-0 top-0 h-full bg-surface border-l border-line shadow-xl flex flex-col", width === "lg" ? "w-[720px] max-w-full" : "w-[480px] max-w-full")} role="dialog" aria-modal="true">
            <div className="flex items-start justify-between px-5 py-4 border-b border-line">
              <div>
                <h2 className="text-sm font-semibold text-ink">{title}</h2>
                {description ? <p className="text-xs text-ink-muted mt-0.5">{description}</p> : null}
              </div>
              <Button variant="ghost" size="icon" onClick={close} aria-label="Close"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{typeof children === "function" ? children(close) : children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
