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
export function MemberNetwork({ broughtMeIn, broughtIn, connected, inviteHref }: { broughtMeIn: NetPerson | null; broughtIn: NetTie[]; connected: NetTie[]; inviteHref: string }) {
  const ring = [...broughtIn, ...connected].slice(0, 12);
  const C = 120, R = 86;
  const at = (i: number, n: number) => { const a = -Math.PI / 2 + ((i + (broughtMeIn ? 0.5 : 0)) / Math.max(n, 1)) * Math.PI * 2; return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) }; };
  const total = broughtIn.length + connected.length + (broughtMeIn ? 1 : 0);
  return (
    <section className="mb-6" aria-labelledby="member-network" data-member-network>
      <h2 id="member-network" className="section-title text-[18px]">Your network here</h2>
      <div className="mt-3.5 grid grid-cols-1 items-center gap-6 rounded-[20px] border border-line bg-surface p-5 md:grid-cols-[240px_1fr]">
        <svg viewBox="0 0 240 240" className="mnet mx-auto h-[220px] w-[220px]" role="img" aria-label={`You and ${total} ${total === 1 ? "person" : "people"} you know here`}>
          <circle cx={C} cy={C} r={R} className="mnet-orbit" />
          {broughtMeIn ? <line x1={C} y1={C} x2={C} y2={C - R - 6} className="mnet-line is-in" /> : null}
          {ring.map((t, i) => { const p = at(i, ring.length); return <line key={t.id} x1={C} y1={C} x2={p.x} y2={p.y} className={`mnet-line ${t.how === "connected" ? "is-link" : "is-out"}`} />; })}
          {broughtMeIn ? <g className="mnet-node is-in" style={{ animationDelay: "0.3s" }}><circle cx={C} cy={C - R - 6} r={17} /><text x={C} y={C - R - 2}>{initials(broughtMeIn)}</text></g> : null}
          {ring.map((t, i) => { const p = at(i, ring.length); return <g key={t.id} className={`mnet-node ${t.how === "connected" ? "is-link" : "is-out"}`} style={{ animationDelay: `${(i % 5) * 0.6}s` }}><circle cx={p.x} cy={p.y} r={15} /><text x={p.x} y={p.y + 4}>{initials(t)}</text></g>; })}
          <g className="mnet-me"><circle cx={C} cy={C} r={26} /><text x={C} y={C + 4}>You</text></g>
        </svg>
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
