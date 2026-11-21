"use client";
import { useEffect, useState } from "react";
import { localTime } from "@/lib/place";

/** Their local time, ticking. The server renders it first, so it is never blank. */
export function LocalClock({ zone, initial }: { zone: string; initial: string }) {
  const [t, setT] = useState(initial);
  useEffect(() => { const tick = () => setT(localTime(zone)); tick(); const id = setInterval(tick, 20_000); return () => clearInterval(id); }, [zone]);
  return <time suppressHydrationWarning className="tabular">{t}</time>;
}
