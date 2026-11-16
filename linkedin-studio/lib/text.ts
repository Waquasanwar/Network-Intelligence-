/** Draft checks that run as you type. No network, no AI. */

export const LINKEDIN_MAX_CHARS = 3000;
/** Roughly where LinkedIn cuts a post with "...see more" (desktop ~210, mobile less). */
export const SEE_MORE_CHARS = 210;
export const SEE_MORE_LINES = 3;

export function firstLine(text: string): string {
  return text.trim().split(/\n/)[0]?.trim() ?? "";
}

/** The part of the post people see before tapping "see more". */
export function aboveTheFold(text: string): string {
  const t = text.trim();
  const lines = t.split("\n").slice(0, SEE_MORE_LINES).join("\n");
  return lines.length > SEE_MORE_CHARS ? lines.slice(0, SEE_MORE_CHARS) : lines;
}

export function titleFrom(text: string, max = 80): string {
  const line = firstLine(text).replace(/\s+/g, " ");
  if (!line) return "Untitled draft";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export type CheckLevel = "good" | "warn" | "info";
export interface Check {
  id: string;
  level: CheckLevel;
  label: string;
}

export interface TextStats {
  chars: number;
  words: number;
  lines: number;
  readingSeconds: number;
  hashtags: number;
  links: number;
  avgSentenceWords: number;
  longestParagraph: number;
}

export function stats(text: string): TextStats {
  const t = text.trim();
  const words = t ? t.split(/\s+/).length : 0;
  const sentences = t.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  const paragraphs = t.split(/\n\s*\n/).map((p) => p.trim().length);
  return {
    chars: t.length,
    words,
    lines: t ? t.split("\n").length : 0,
    readingSeconds: Math.round((words / 230) * 60),
    hashtags: (t.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length,
    links: (t.match(/https?:\/\/\S+/g) ?? []).length,
    avgSentenceWords: sentences.length ? Math.round(words / sentences.length) : 0,
    longestParagraph: paragraphs.length ? Math.max(...paragraphs) : 0,
  };
}

export function checks(text: string): Check[] {
  const s = stats(text);
  const out: Check[] = [];
  if (!s.chars) return out;
  const hook = firstLine(text);

  if (s.chars > LINKEDIN_MAX_CHARS)
    out.push({ id: "max", level: "warn", label: `Over LinkedIn's ${LINKEDIN_MAX_CHARS} character limit by ${s.chars - LINKEDIN_MAX_CHARS}.` });
  else if (s.chars < 300) out.push({ id: "short", level: "info", label: "Very short. Fine for a punchy take; add a line of context if it needs it." });
  else out.push({ id: "len", level: "good", label: `${s.chars} characters, about ${Math.max(1, Math.round(s.readingSeconds / 10) * 10)} seconds to read.` });

  if (hook.length > 120) out.push({ id: "hook-long", level: "warn", label: "Opening line is long. Hooks that land usually fit in one short line." });
  else if (hook.length > 0) out.push({ id: "hook", level: "good", label: "Opening line is short enough to read at a glance." });

  if (aboveTheFold(text).length < Math.min(s.chars, 60))
    out.push({ id: "fold", level: "info", label: "Very little shows before \"see more\". Make sure line one earns the click." });

  if (s.hashtags > 3) out.push({ id: "tags", level: "warn", label: `${s.hashtags} hashtags. Three or fewer reads cleaner.` });
  if (s.links > 0) out.push({ id: "links", level: "info", label: "Has a link in the body. Many creators put links in the first comment instead; test it against your own numbers." });
  if (s.longestParagraph > 400) out.push({ id: "wall", level: "warn", label: "One paragraph is a wall of text. Break it up; people read LinkedIn on phones." });
  if (s.avgSentenceWords > 24) out.push({ id: "sent", level: "warn", label: `Sentences average ${s.avgSentenceWords} words. Shorter ones read faster.` });

  const last = text.trim().split("\n").filter(Boolean).pop() ?? "";
  if (/\?\s*$/.test(last)) out.push({ id: "cta", level: "good", label: "Ends with a question, which invites comments." });
  else out.push({ id: "cta", level: "info", label: "No closing question or call to action. Optional, but it tends to lift comments." });

  return out;
}
