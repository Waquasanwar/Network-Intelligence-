// Display helpers. Called from client components so dates render in the viewer's timezone.

export function time(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  const t = new Date(`${today}T12:00:00`);
  const d = new Date(`${ymd}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  const sameYear = t.getFullYear() === d.getFullYear();
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export function shortDate(ymd: string, today?: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (today) {
    const diff = Math.round((d.getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000);
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff === -1) return "yesterday";
    if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(fromIso: string, to = new Date()): number {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromIso) ? new Date(`${fromIso}T12:00:00`) : new Date(fromIso);
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}
