"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentMark } from "./agent-mark";
import { cn } from "@/lib/utils";

export type PulseLine = { text: string; href?: string };

/**
 * What the agent is doing right now, in one living line. Each line is a real fact from the network,
 * worked out on the server; the mark breathes and the line moves on every few seconds. It holds
 * still while you point at it or tab to it, and never moves for people who ask for less motion.
 * It is not a live region, so a screen reader is not interrupted each time the line changes.
 */
export function AgentPulse({ lines, onInk = false, className }: { lines: PulseLine[]; onInk?: boolean; className?: string }) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (lines.length < 2 || held || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 4600);
    return () => clearInterval(t);
  }, [lines.length, held]);
  if (!lines.length) return null;
  const line = lines[i % lines.length];
  const body = (
    <>
      <span key={i} className="pulse-text">{line.text}</span>
      {line.href ? <ArrowRight className="pulse-go h-3.5 w-3.5 flex-none" aria-hidden="true" /> : null}
    </>
  );
  return (
    <div className={cn("pulse", onInk && "is-ink", className)} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)} data-agent-pulse>
      <span className="pulse-orb" aria-hidden="true"><AgentMark size={16} busy /></span>
      <span className="sr-only">Amana: </span>
      <span className="min-w-0 flex-1">
        {line.href ? <Link href={line.href} className="pulse-line">{body}</Link> : <span className="pulse-line">{body}</span>}
      </span>
      {lines.length > 1 ? (
        <span className="pulse-dots" aria-hidden="true">{lines.map((l, n) => <button key={l.text} type="button" tabIndex={-1} onClick={() => setI(n)} data-on={n === i % lines.length || undefined} />)}</span>
      ) : null}
    </div>
  );
}
