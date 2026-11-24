"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentMark } from "./agent-mark";
import { cn } from "@/lib/utils";

export type PulseLine = { text: string; href?: string };

/**
 * What the agent is doing right now, one line at a time. Each line is a real fact from the network,
 * worked out on the server. Nothing moves on its own: the dots beside it step through the lines.
 */
export function AgentPulse({ lines, onInk = false, className }: { lines: PulseLine[]; onInk?: boolean; className?: string }) {
  const [i, setI] = useState(0);
  if (!lines.length) return null;
  const line = lines[i % lines.length];
  const body = (
    <>
      <span key={i} className="pulse-text">{line.text}</span>
      {line.href ? <ArrowRight className="pulse-go h-3.5 w-3.5 flex-none" aria-hidden="true" /> : null}
    </>
  );
  return (
    <div className={cn("pulse", onInk && "is-ink", className)} data-agent-pulse>
      <span className="pulse-orb" aria-hidden="true"><AgentMark size={28} /></span>
      <span className="sr-only">Amana: </span>
      <span className="min-w-0 flex-1">
        {line.href ? <Link href={line.href} className="pulse-line">{body}</Link> : <span className="pulse-line">{body}</span>}
      </span>
      {lines.length > 1 ? (
        <span className="pulse-dots" role="group" aria-label="What the agent is doing">{lines.map((l, n) => <button key={l.text} type="button" onClick={() => setI(n)} aria-label={`Show: ${l.text}`} aria-pressed={n === i % lines.length} data-on={n === i % lines.length || undefined} />)}</span>
      ) : null}
    </div>
  );
}
