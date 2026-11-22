import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
import { fullName } from "@/lib/utils";
import { KNOWN_HOW, isKnownHow } from "@/lib/known";
import type { NetPerson, NetTie } from "@/server/member-network";

const HOW: Record<NetTie["how"], string> = { invited: "You invited them", referred: "You referred them", introduced: "You introduced them", connected: "Connected" };
const initials = (p: NetPerson) => `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

/**
 * The member's own corner of the network: who brought them in, who they brought in, and who they
 * are connected with, drawn around them, with the same people listed beside it in words.
 */
export function MemberNetwork({ broughtMeIn, broughtIn, connected, inviteHref, compact = false }: { compact?: boolean; broughtMeIn: NetPerson | null; broughtIn: NetTie[]; connected: NetTie[]; inviteHref: string }) {
  const ring = [...broughtIn, ...connected].slice(0, 12);
  const total = broughtIn.length + connected.length + (broughtMeIn ? 1 : 0);
  return (
    <section className={compact ? "" : "mb-6"} aria-labelledby="member-network" data-member-network>
      <h2 id="member-network" className="section-title text-[18px]">Your network here</h2>
      <div className={`mt-3.5 grid grid-cols-1 items-start gap-4 ${compact ? "" : "md:grid-cols-[minmax(0,320px)_1fr]"}`}>
        <MiniSky broughtMeIn={broughtMeIn} ties={ring} total={total} />
        <div className="min-w-0 space-y-4">
          {broughtMeIn ? <p className="text-[13.5px] text-ink-muted"><b className="font-semibold text-ink">{fullName(broughtMeIn)}</b> brought you in{broughtMeIn.headline ? ` · ${broughtMeIn.headline}` : ""}.</p> : null}
          {broughtIn.length ? (
            <div>
              <h3 className="text-[13px] font-semibold text-ink">People you brought in</h3>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">{broughtIn.map((t) => <li key={t.id} className="tag" title={`${HOW[t.how]}${isKnownHow(t.knownHow) ? ` · ${KNOWN_HOW[t.knownHow].label.toLowerCase()}` : ""}`}>{fullName(t)}<span className="text-ink-faint"> · {isKnownHow(t.knownHow) ? KNOWN_HOW[t.knownHow].label.toLowerCase() : HOW[t.how].toLowerCase()}</span></li>)}</ul>
            </div>
          ) : null}
          {connected.length ? (
            <div>
              <h3 className="text-[13px] font-semibold text-ink">Connected with</h3>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">{connected.map((t) => <li key={t.id}><Link href="/community?tab=connections" className="tag hover:text-ink">{fullName(t)}</Link></li>)}</ul>
            </div>
          ) : null}
          {!broughtIn.length && !connected.length ? <p className="max-w-[52ch] text-[13.5px] leading-[1.55] text-ink-muted">This fills in as you bring people in and connect with members. Everyone you add makes the network better at finding you work, and at finding work for them.</p> : null}
          <Link href={inviteHref} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink"><UserPlus className="h-3.5 w-3.5" aria-hidden="true" />Bring someone in<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Your own small sky: you on the horizon, the person who brought you in shining above, and the people
 * you brought in or are connected with rising around you, each on its own arc of light.
 */
function MiniSky({ broughtMeIn, ties, total }: { broughtMeIn: NetPerson | null; ties: NetTie[]; total: number }) {
  const W = 320, H = 210, you = { x: W / 2, y: H - 26 };
  const n = ties.length;
  // Fan the people across the sky, leaving the top centre to whoever brought you in.
  const spots = ties.map((t, i) => {
    const f = n === 1 ? 0.3 : i / (n - 1);
    const a = broughtMeIn ? (f < 0.5 ? 0.14 + f * 0.6 : 0.56 + (f - 0.5) * 0.6) * Math.PI : (0.14 + f * 0.72) * Math.PI;
    const lift = i % 2 ? 0.78 : 1;
    return { t, x: you.x - Math.cos(a) * 128, y: you.y - Math.sin(a) * 140 * lift };
  });
  const arc = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x},${a.y} Q${(a.x + b.x) / 2},${Math.min(a.y, b.y) - 18 - Math.abs(a.x - b.x) * 0.12} ${b.x},${b.y}`;
  const guide = { x: you.x, y: 30 };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="msky" role="img" aria-label={`You and ${total} ${total === 1 ? "person" : "people"} you know here${broughtMeIn ? `, brought in by ${fullName(broughtMeIn)}` : ""}`}>
      <defs>
        <linearGradient id="msky-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#060d22" /><stop offset="1" stopColor="#0f2a4d" /></linearGradient>
        <radialGradient id="msky-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff6d6" /><stop offset=".4" stopColor="#f2c46d" stopOpacity=".9" /><stop offset="1" stopColor="#f2c46d" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={W} height={H} rx="20" fill="url(#msky-bg)" />
      {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={(i * 97) % W} cy={(i * 53) % (H - 50) + 6} r={i % 5 ? 0.7 : 1.2} fill="#fff" opacity={0.15 + ((i * 37) % 10) / 22} />)}
      <path d={`M0,${H - 14} Q${W / 2},${H - 40} ${W},${H - 14} L${W},${H} L0,${H} Z`} fill="#071327" />
      <path d={`M0,${H - 14} Q${W / 2},${H - 40} ${W},${H - 14}`} fill="none" stroke="#7ee3bc" strokeOpacity=".55" />
      {broughtMeIn ? <path d={arc(guide, you)} className="msky-arc is-in" pathLength={1} /> : null}
      {spots.map((s, i) => <path key={s.t.id} d={arc(you, s)} className={`msky-arc ${s.t.how === "connected" ? "is-link" : "is-out"}`} pathLength={1} style={{ animationDelay: `${0.3 + i * 0.18}s` }} />)}
      <circle cx={you.x} cy={you.y} r="24" fill="url(#msky-sun)" className="msky-sun" />
      <text x={you.x} y={you.y + 3.5} className="msky-you">YOU</text>
      {broughtMeIn ? <g className="msky-star is-in"><circle cx={guide.x} cy={guide.y} r="6" /><text x={guide.x + 11} y={guide.y + 4} textAnchor="start">{broughtMeIn.firstName} brought you in</text></g> : null}
      {spots.map((s, i) => (
        <g key={s.t.id} className={`msky-star ${s.t.how === "connected" ? "is-link" : "is-out"}`} style={{ animationDelay: `${(i % 5) * 0.7}s` }}>
          <circle cx={s.x} cy={s.y} r={s.t.how === "connected" ? 4 : 5.5} />
          <text x={s.x} y={s.y + 16}>{s.t.firstName}</text>
        </g>
      ))}
      {!n && !broughtMeIn ? <text x={W / 2} y={H / 2 - 10} className="msky-empty">Your sky fills as you bring people in</text> : null}
    </svg>
  );
}
