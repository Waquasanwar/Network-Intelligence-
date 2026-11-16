"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up to its value on first paint. The server renders the final value, so nothing is ever blank. */
export function Ticker({ value, duration = 1100, decimals = 0, suffix = "" }: { value: number; duration?: number; decimals?: number; suffix?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduced() || value === 0) return setShown(value);
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setShown(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "3 min ago", kept current. */
export function TimeAgo({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return <time dateTime={iso} suppressHydrationWarning title={new Date(iso).toLocaleString("en-GB")}>{ago(iso, now)}</time>;
}

/**
 * The live badge. Re-fetches the page from Notion every `everySeconds` while the tab is visible,
 * and immediately when you come back to the tab.
 */
export function LivePill({ updatedAt, everySeconds = 120 }: { updatedAt: string | null; everySeconds?: number }) {
  const router = useRouter();
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setBeat((b) => b + 1);
    };
    const t = setInterval(tick, everySeconds * 1000);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, everySeconds]);
  return (
    <span className="live-pill" aria-live="polite" key={beat}>
      <span className="live-dot" aria-hidden />
      <b>Live</b>
      <span className="faint">{updatedAt ? <>· data updated <TimeAgo iso={updatedAt} /></> : "· waiting for first import"}</span>
    </span>
  );
}
