"use client";
import { useEffect } from "react";

/**
 * One listener for the whole app: whichever `.glass-tile` or `.spot` the pointer is over gets the
 * cursor position as --mx / --my, and CSS paints a soft light there. No per-card handlers.
 */
export function Spotlight() {
  useEffect(() => {
    if (matchMedia("(hover: none)").matches) return;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(".glass-tile, .spot");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);
  return null;
}
