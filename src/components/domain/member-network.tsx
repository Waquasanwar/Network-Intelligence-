import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
import { fullName } from "@/lib/utils";
import { KNOWN_HOW, isKnownHow } from "@/lib/known";
import type { NetPerson, NetTie } from "@/server/member-network";
import { TrustOrbit, type OrbitPerson } from "@/components/domain/trust-orbit";

const HOW: Record<NetTie["how"], string> = { invited: "You invited them", referred: "You referred them", introduced: "You introduced them", connected: "Connected" };
const GROUPS = [{ key: "in", label: "Brought you in" }, { key: "out", label: "You brought in" }, { key: "link", label: "Connected with" }];

/**
 * The member's own corner of the network: who brought them in, who they brought in, and who they
 * are connected with, drawn around them as faces in circles (closest first: whoever brought them in and people they have
 * worked with, then the people they brought in, then their connections), with the same people listed
 * beside it in words. Only their own ties are drawn; nobody else's are.
 */
export function MemberNetwork({ me, broughtMeIn, broughtIn, connected, inviteHref, compact = false }: { compact?: boolean; me?: { name: string; photo?: string | null }; broughtMeIn: NetPerson | null; broughtIn: NetTie[]; connected: NetTie[]; inviteHref: string }) {
  const total = broughtIn.length + connected.length + (broughtMeIn ? 1 : 0);
  const face = (p: NetPerson) => ({ id: p.id, name: fullName(p), headline: p.headline, photo: p.photo });
  const people: OrbitPerson[] = [
    ...(broughtMeIn ? [{ ...face(broughtMeIn), ring: 0 as const, groups: ["in"], note: "Brought you in" }] : []),
    ...broughtIn.map((t) => ({ ...face(t), ring: t.knownHow === "worked" ? (0 as const) : (1 as const), groups: ["out"], note: isKnownHow(t.knownHow) ? `${HOW[t.how]} · ${KNOWN_HOW[t.knownHow].label.toLowerCase()}` : HOW[t.how] })),
    ...connected.map((t) => ({ ...face(t), ring: 2 as const, groups: ["link"], note: "Connected with you", href: "/community?tab=connections", hrefLabel: "Open connections" })),
  ];
  return (
    <section className={compact ? "" : "mb-6"} aria-labelledby="member-network" data-member-network>
      <h2 id="member-network" className="section-title text-[18px]">Your network here</h2>
      <div className={`mt-3.5 grid grid-cols-1 items-start gap-4 ${compact ? "" : "md:grid-cols-[minmax(0,380px)_1fr]"}`}>
        <TrustOrbit compact centre={me ?? { name: "You" }} people={people} groups={GROUPS} heightClass="h-[320px]" label={`You and ${total} ${total === 1 ? "person" : "people"} you know here${broughtMeIn ? `, brought in by ${fullName(broughtMeIn)}` : ""}`} />
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
