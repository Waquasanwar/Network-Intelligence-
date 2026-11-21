"use client";
import { useEffect, useState } from "react";
import { offsetHours, localTime } from "@/lib/place";

/**
 * Their working day against yours, on one 24-hour line in your time: your 9–6 outlined, theirs
 * filled, the hours you share in mint, and a tick for now. Read in the viewer's own time zone, so it
 * is right wherever you open it. Beside it, a small clock with their local time.
 */
export function TimeTogether({ zone, city }: { zone: string; city: string }) {
  const [view, setView] = useState<{ mine: number; theirs: number; now: number; time: string } | null>(null);
  useEffect(() => {
    const read = () => {
      const me = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const d = new Date();
      const mine = offsetHours(me, d), theirs = offsetHours(zone, d);
      const local = new Date(d.getTime() + mine * 3_600_000);
      setView({ mine, theirs, now: local.getUTCHours() + local.getUTCMinutes() / 60, time: localTime(zone, d) });
    };
    read(); const id = setInterval(read, 30_000); return () => clearInterval(id);
  }, [zone]);

  // Their 9–18 in my hours. Segments may wrap past midnight.
  const shift = view ? view.mine - view.theirs : 0;
  const theirStart = (((9 + shift) % 24) + 24) % 24;
  const segs = (start: number, len: number) => start + len <= 24 ? [[start, len]] : [[start, 24 - start], [0, start + len - 24]];
  const overlap = view ? Math.max(0, Math.min(18, 18 + shift) - Math.max(9, 9 + shift)) : 0;
  const pct = (h: number) => `${(h / 24) * 100}%`;
  const label = (h: number) => `${String(Math.floor(((h % 24) + 24) % 24)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
  const hours = view?.time.split(":").map(Number) ?? [12, 0];
  const hAngle = ((hours[0] % 12) + hours[1] / 60) * 30, mAngle = hours[1] * 6;

  return (
    <div className="together" data-time-together>
      <svg viewBox="0 0 44 44" className="together-clock" aria-hidden="true">
        <circle cx="22" cy="22" r="20" className="together-face" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <line key={i} x1="22" y1="4.5" x2="22" y2={i % 3 ? "6" : "7.5"} transform={`rotate(${i * 30} 22 22)`} className="together-tick" />)}
        <line x1="22" y1="22" x2="22" y2="12" transform={`rotate(${hAngle} 22 22)`} className="together-hour" />
        <line x1="22" y1="22" x2="22" y2="8" transform={`rotate(${mAngle} 22 22)`} className="together-min" />
        <circle cx="22" cy="22" r="1.8" className="together-pin" />
      </svg>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <b className="text-[18px] font-semibold tabular text-ink" suppressHydrationWarning>{view?.time ?? "--:--"}</b>
          <span className="text-[13px] text-ink-muted">in {city}</span>
        </div>
        <div className="together-bar" role="img" aria-label={view ? `Their working day, 9 to 6 their time, is ${label(9 + shift)} to ${label(18 + shift)} your time. You share ${overlap} working hours.` : "Their working day against yours"}>
          <span className="together-mine" style={{ left: pct(9), width: pct(9) }} />
          {segs(theirStart, 9).map(([s, l], i) => <span key={i} className="together-theirs" style={{ left: pct(s), width: pct(l) }} />)}
          {overlap ? <span className="together-shared" style={{ left: pct(Math.max(9, 9 + shift)), width: pct(overlap) }} /> : null}
          {view ? <span className="together-now" style={{ left: pct(view.now) }} /> : null}
        </div>
        <div className="mt-1 flex justify-between text-[11.5px] text-ink-faint" suppressHydrationWarning>
          <span>{view ? (Math.abs(shift) < 0.25 ? "Same time as you" : `${Math.abs(shift)}h ${shift < 0 ? "ahead of" : "behind"} you`) : ""}</span>
          <span>{view ? `${overlap}h of your working day shared` : ""}</span>
        </div>
      </div>
    </div>
  );
}
