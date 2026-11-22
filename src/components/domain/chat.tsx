"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUp, Search } from "lucide-react";

/**
 * The moving parts of the members' messages: a thread that opens at the latest message, a composer
 * that grows as you type and sends on Enter, a search over your conversations, and times shown in
 * the reader's own clock.
 */

/** The message list, scrolled to the newest message when it opens and whenever one arrives. */
export function ChatScroll({ count, children, label }: { count: number; children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [count]);
  return <ol ref={ref} className="chat-scroll" aria-label={label} tabIndex={0}>{children}</ol>;
}

function Send() {
  const { pending } = useFormStatus();
  return <button type="submit" className="chat-send" aria-label="Send message" disabled={pending}><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>;
}

/** Type and press Enter to send; Shift+Enter for a new line. Grows up to a few lines. */
export function ChatComposer({ action, connectionId, name }: { action: (fd: FormData) => void | Promise<void>; connectionId: string; name: string }) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const grow = () => { const el = ta.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; };
  return (
    <form action={action} className="chat-composer" onSubmit={() => setTimeout(() => { if (ta.current) { ta.current.value = ""; grow(); } }, 0)}>
      <input type="hidden" name="connectionId" value={connectionId} />
      <textarea
        ref={ta} name="body" rows={1} required maxLength={2000} autoComplete="off"
        placeholder={`Message ${name}`} aria-label={`Message ${name}`}
        onInput={grow}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (e.currentTarget.value.trim()) e.currentTarget.form?.requestSubmit(); } }}
      />
      <Send />
    </form>
  );
}

/** Filters the conversation list by name as you type. Rows carry their name in data-name. */
export function ChatSearch({ listId }: { listId: string }) {
  return (
    <label className="chat-search">
      <Search className="h-4 w-4 flex-none" aria-hidden="true" />
      <input
        type="search" placeholder="Search messages" aria-label="Search your conversations"
        onInput={(e) => {
          const q = e.currentTarget.value.trim().toLowerCase();
          document.querySelectorAll<HTMLElement>(`#${listId} [data-name]`).forEach((li) => { li.hidden = !!q && !(li.dataset.name ?? "").includes(q); });
        }}
      />
    </label>
  );
}

const DAY = 86_400_000;

/** "14:05" for today, "Yesterday", "Mon", or "18 Nov": in the reader's own time zone once on screen. */
export function ShortTime({ iso, mode = "list" }: { iso: string; mode?: "list" | "clock" }) {
  const fmt = (tz?: string) => {
    const d = new Date(iso), now = new Date();
    const o = (x: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
    const clock = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    if (mode === "clock" || o(d) === o(now)) return clock;
    if (o(d) === o(new Date(now.getTime() - DAY))) return "Yesterday";
    if (now.getTime() - d.getTime() < 6 * DAY) return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(d);
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(d);
  };
  const [t, setT] = useState(() => fmt("UTC"));
  useEffect(() => { setT(fmt()); }, [iso]); // eslint-disable-line react-hooks/exhaustive-deps
  return <time dateTime={iso} suppressHydrationWarning>{t}</time>;
}

/** The divider between days in a thread: "Today", "Yesterday" or the date, in the reader's time zone. */
export function DayLabel({ iso }: { iso: string }) {
  const fmt = (tz?: string) => {
    const key = (x: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
    const d = new Date(iso), now = new Date();
    if (key(d) === key(now)) return "Today";
    if (key(d) === key(new Date(now.getTime() - DAY))) return "Yesterday";
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(d);
  };
  const [t, setT] = useState(() => fmt("UTC"));
  useEffect(() => { setT(fmt()); }, [iso]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span suppressHydrationWarning>{t}</span>;
}
