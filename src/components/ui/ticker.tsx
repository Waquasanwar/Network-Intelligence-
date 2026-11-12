"use client";
import { useEffect, useState } from "react";

/** A number that counts up to its value when it first appears. The server renders the final value, so nothing is ever blank. */
export function Ticker({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) { setShown(value); return; }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setShown(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toLocaleString("en-GB")}</>;
}
