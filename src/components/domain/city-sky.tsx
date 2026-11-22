"use client";
import { useEffect, useMemo, useState } from "react";
import { localTime } from "@/lib/place";

/**
 * A banner for a profile, made from where the person is: their city's sky at its own time of day,
 * the sun or moon where it would be, and a skyline drawn from the city's name, so every profile has
 * a picture of its own without anyone uploading one. The server renders the hour it saw; the
 * browser keeps it current.
 */

type Phase = "night" | "dawn" | "day" | "dusk";
const phaseOf = (h: number): Phase => (h < 5 || h >= 20.5 ? "night" : h < 7.5 ? "dawn" : h < 17.5 ? "day" : "dusk");
const SKY: Record<Phase, [string, string, string]> = {
  night: ["#040a1b", "#0b1f45", "#163763"],
  dawn: ["#14234f", "#7a4f7d", "#f0a874"],
  day: ["#0d3c78", "#2f6fb2", "#7fb2de"],
  dusk: ["#141a46", "#6a3566", "#ee8a5c"],
};
const hoursOf = (t: string) => { const [h, m] = t.split(":").map(Number); return h + m / 60; };

function rng(seed: string) {
  let s = 0; for (let i = 0; i < seed.length; i++) s = Math.imul(s ^ seed.charCodeAt(i), 2654435761) >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function CitySky({ city, zone, initialTime, className }: { city: string | null; zone: string | null; initialTime: string | null; className?: string }) {
  const [time, setTime] = useState(initialTime);
  useEffect(() => { if (!zone) return; const tick = () => setTime(localTime(zone)); tick(); const id = setInterval(tick, 60_000); return () => clearInterval(id); }, [zone]);
  const h = time ? hoursOf(time) : 22;
  const phase = phaseOf(h);
  const [top, mid, low] = SKY[phase];

  // The skyline and the stars come from the city's name, so they are the same every visit.
  const art = useMemo(() => {
    const r = rng((city ?? "network").toLowerCase());
    const towers: { x: number; w: number; h: number; spire: boolean }[] = [];
    let x = -10;
    while (x < 1210) { const w = 14 + r() * 34, tall = r() < 0.12; towers.push({ x, w, h: tall ? 70 + r() * 60 : 14 + r() * 46, spire: tall && r() < 0.6 }); x += w + r() * 6; }
    const stars = Array.from({ length: 46 }, () => ({ x: r() * 1200, y: r() * 120, r: r() < 0.85 ? 0.8 : 1.5, o: 0.25 + r() * 0.6 }));
    const windows = towers.flatMap((t) => Array.from({ length: Math.floor(t.h / 14) }, (_, i) => ({ x: t.x + 4 + r() * Math.max(1, t.w - 8), y: 200 - t.h + 8 + i * 12, on: r() < 0.35 })));
    return { towers, stars, windows };
  }, [city]);

  // Sun by day, moon by night, travelling a low arc across the banner through the hours.
  const sunT = Math.max(0, Math.min(1, (h - 6) / 12)), moonT = ((h + 24 - 19) % 24) / 11;
  const body = phase === "night" ? { x: 120 + Math.min(1, moonT) * 960, y: 70 - Math.sin(Math.min(1, moonT) * Math.PI) * 40, moon: true } : { x: 120 + sunT * 960, y: 150 - Math.sin(sunT * Math.PI) * 110, moon: false };
  const lit = phase === "night" || phase === "dusk";

  return (
    <div className={className} aria-hidden="true" data-city-sky={phase}>
      <svg viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="csky-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset=".62" stopColor={mid} /><stop offset="1" stopColor={low} /></linearGradient>
          <radialGradient id="csky-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={body.moon ? "#f4f1e6" : "#fff4cf"} /><stop offset=".35" stopColor={body.moon ? "#dfe6f5" : "#ffd27a"} stopOpacity=".9" /><stop offset="1" stopColor={body.moon ? "#a9c6ff" : "#ffb25b"} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="1200" height="200" fill="url(#csky-g)" />
        {phase !== "day" ? art.stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={phase === "night" ? s.o : s.o * 0.35} />) : null}
        <circle cx={body.x} cy={body.y} r={body.moon ? 46 : 70} fill="url(#csky-sun)" />
        {body.moon ? <circle cx={body.x} cy={body.y} r={11} fill="#f4f1e6" /> : <circle cx={body.x} cy={body.y} r={15} fill="#fff6d8" />}
        <g fill={phase === "day" ? "#0b2547" : "#050d1e"} opacity={phase === "day" ? 0.55 : 0.92}>
          {art.towers.map((t, i) => <g key={i}><rect x={t.x} y={200 - t.h} width={t.w} height={t.h} />{t.spire ? <path d={`M${t.x + t.w / 2 - 2},${200 - t.h} L${t.x + t.w / 2},${200 - t.h - 26} L${t.x + t.w / 2 + 2},${200 - t.h} Z`} /> : null}</g>)}
        </g>
        {lit ? art.windows.filter((w) => w.on).map((w, i) => <rect key={i} x={w.x} y={w.y} width="2.2" height="2.2" fill="#f7d892" opacity=".8" />) : null}
      </svg>
      {city ? <span className="city-sky-caption" suppressHydrationWarning>{city}{time ? ` · ${time}` : ""}</span> : null}
    </div>
  );
}
