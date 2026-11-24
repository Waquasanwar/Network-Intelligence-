import { BrandMark } from "./brand-mark";

/**
 * Amana's mark wherever Amana speaks or asks: the Amana logo in white on an indigo tile with
 * softened corners. One shape and one colour everywhere, so it reads as the brand, not as a
 * generic assistant. `size` is the tile's width in pixels; `busy` is kept for callers but the
 * mark is always still.
 */
export function AgentMark({ size = 24, className = "" }: { size?: number; busy?: boolean; className?: string }) {
  return (
    <span className={`agent-mark ${className}`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }} aria-hidden="true">
      <BrandMark className="agent-mark-logo" />
    </span>
  );
}
