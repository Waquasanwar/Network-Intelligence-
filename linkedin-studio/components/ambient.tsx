"use client";

import { useEffect } from "react";

/**
 * The living background: a slow coral / ink-blue aurora behind the glass, plus a soft light that
 * follows the pointer across cards. One passive listener for the whole page; nothing runs when the
 * user prefers reduced motion or uses touch.
 */
export function Ambient() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return;
    let raf = 0;
    let last: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const card = (e.target as HTMLElement | null)?.closest?.(".card, .hero, .btn.primary") as HTMLElement | null;
        if (last && last !== card) last.style.removeProperty("--lit");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
        card.style.setProperty("--lit", "1");
        last = card;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className="aurora" aria-hidden>
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <span className="grain" />
    </div>
  );
}
