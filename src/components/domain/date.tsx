import { format, formatDistanceToNowStrict, isPast } from "date-fns";

export function DateText({ date, relative = false, className }: { date: Date | string | null | undefined; relative?: boolean; className?: string }) {
  if (!date) return <span className={className}>—</span>;
  const d = typeof date === "string" ? new Date(date) : date;
  const abs = format(d, "d MMM yyyy");
  if (!relative) return <span className={className} title={abs}>{abs}</span>;
  const rel = formatDistanceToNowStrict(d, { addSuffix: true });
  return <span className={className} title={abs}>{isPast(d) ? rel : `in ${formatDistanceToNowStrict(d)}`}</span>;
}
