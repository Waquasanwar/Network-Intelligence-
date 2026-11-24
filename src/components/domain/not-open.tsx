import Link from "next/link";
import { ShieldCheck, Lock } from "lucide-react";
import { AgentMark } from "@/components/ui/agent-mark";

/**
 * What someone sees where the owner has not released a part of the network yet: a calm note, not
 * an error, and the settings that are always theirs (privacy and security).
 */
export function NotOpen({ title = "Your space is being prepared", body, privacyHref, member = false }: { title?: string; body?: string; privacyHref?: string; member?: boolean }) {
  return (
    <section className="not-open" data-not-open>
      <span className="not-open-core" aria-hidden="true"><AgentMark size={56} /></span>
      <h1 className="mt-5 font-display text-[26px] font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-[30px]">{title}</h1>
      <p className="mt-2.5 max-w-[46ch] text-[15px] leading-[1.6] text-ink-muted">{body ?? "Amana Network opens in stages. This part is not open yet. We will let you know as soon as it is, and nothing you have shared is used until then."}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {member && privacyHref ? <Link href={privacyHref} className="not-open-link"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Privacy & data</Link> : null}
        <Link href="/settings/security" className="not-open-link"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Security</Link>
      </div>
    </section>
  );
}
