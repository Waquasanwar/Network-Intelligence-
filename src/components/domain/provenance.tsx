import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The provenance thread: who knows this person and through whom.
 * Owner → (introducer) → person. A teal link means someone has worked with them directly.
 */
export function ProvenanceThread({
  owner,
  introducer,
  person,
  workedTogether,
  compact = false,
  className,
}: {
  owner: { name: string };
  introducer?: { id: string; firstName: string; lastName: string } | null;
  person: { firstName: string; lastName: string };
  workedTogether?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const short = (n: string) => (compact ? n.split(" ")[0] : n);
  return (
    <span className={cn("thread", className)} title={`${owner.name}${introducer ? ` introduced via ${introducer.firstName} ${introducer.lastName}` : ""}${workedTogether ? " · worked together" : ""}`}>
      <span className="node self"><span className="dot" />{short(owner.name)}</span>
      {introducer ? (
        <>
          <span className="link" />
          <span className="node"><span className="dot" /><Link href={`/network/${introducer.id}`} className="hover:text-ink hover:underline underline-offset-2">{short(`${introducer.firstName} ${introducer.lastName}`)}</Link></span>
        </>
      ) : null}
      <span className={cn("link", workedTogether && "worked")} />
      <span className={cn("node", workedTogether && "trusted")}><span className="dot" />{short(`${person.firstName} ${person.lastName}`)}</span>
    </span>
  );
}
