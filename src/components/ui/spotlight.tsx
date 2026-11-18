"use client";
import { useEffect } from "react";

/**
 * One listener for the whole app: whichever card the pointer is over gets --mx/--my and a
 * data-lit flag, and globals.css draws the light (after the 21st.dev "Spotlight" pattern).
 * Nothing runs on touch screens or for people who ask for less motion.
 */
export function Spotlight() {
  useEffect(() => {
    if (!matchMedia("(hover: hover)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let lit: HTMLElement | null = null, frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = (e.target instanceof Element ? e.target.closest<HTMLElement>(".widget, .spot") : null);
        if (lit && lit !== el) { lit.removeAttribute("data-lit"); }
        lit = el;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        el.setAttribute("data-lit", "");
      });
    };
    const leave = () => { lit?.removeAttribute("data-lit"); lit = null; };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
