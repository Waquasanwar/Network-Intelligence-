/**
 * How the person who brings someone in knows them. Asked lightly (one optional tap) when a member or
 * the team invites or recommends someone, and shown beside "came through someone we know": the
 * difference between "worked with them" and "know them socially" is the whole point of the network.
 */
export const KNOWN_HOW = {
  worked: { label: "Worked with them", phrase: "has worked with them" },
  seen: { label: "Seen their work", phrase: "has seen their work" },
  know: { label: "Know them personally", phrase: "knows them personally" },
} as const;
export type KnownHow = keyof typeof KNOWN_HOW;
export const isKnownHow = (v: unknown): v is KnownHow => typeof v === "string" && v in KNOWN_HOW;

/** "known since 2019" for a referee, or null. Only years that make sense are kept. */
export const knownSinceLabel = (year: number | null | undefined, now = new Date()) =>
  year && year >= 1960 && year <= now.getFullYear() ? `known since ${year}` : null;
