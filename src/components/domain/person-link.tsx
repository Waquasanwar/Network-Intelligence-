import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { fullName } from "@/lib/utils";

export function PersonLink({ person, sub }: { person: { id: string; firstName: string; lastName: string; preferredName?: string | null; headline?: string | null }; sub?: string | null }) {
  return (
    <Link href={`/network/${person.id}`} className="flex items-center gap-2.5 group min-w-0">
      <Avatar person={person} size="sm" />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink group-hover:underline underline-offset-4 truncate">{fullName(person)}</span>
        {sub !== null ? <span className="block text-[11px] text-ink-faint truncate">{sub ?? person.headline ?? ""}</span> : null}
      </span>
    </Link>
  );
}
