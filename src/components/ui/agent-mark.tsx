/**
 * The agent's mark: you, and two people you know, with the lines between you. It is the network
 * in its smallest form. It pulses only while the agent is working.
 */
export function AgentMark({ size = 20, busy = false, className = "" }: { size?: number; busy?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={`agent-mark ${className}`} data-busy={busy || undefined} aria-hidden="true">
      <line x1="5" y1="14.5" x2="10" y2="5" />
      <line x1="10" y1="5" x2="15" y2="14.5" />
      <line x1="5" y1="14.5" x2="15" y2="14.5" />
      <circle className="is-you" cx="5" cy="14.5" r="2.6" />
      <circle cx="10" cy="5" r="2.6" />
      <circle cx="15" cy="14.5" r="2.6" />
    </svg>
  );
}
