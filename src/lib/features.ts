/**
 * Features the owner switches on when they are ready. Each one really changes what people see,
 * and each has a safe default. Stored on the tenant; anything not set falls back to the default.
 */
export const FEATURES = [
  { key: "earnings", label: "Earnings for members", detail: "Members see their share of placements and the referral percentage. Credits are recorded either way, so nothing is lost while it is off.", default: false, who: "Members" },
  { key: "readAloud", label: "Read screening questions aloud", detail: "A ‘Hear the question’ button on each screening question: the natural voice where a member has agreed to it, otherwise their device's own voice.", default: true, who: "Members" },
  { key: "memberConnections", label: "Members connect with each other", detail: "Members who choose to be seen can find each other and ask to connect. Contact details are shared only when both say yes.", default: true, who: "Members" },
  { key: "communityBoard", label: "Community board", detail: "Members post work they hear about, ask for a specialist, or say they are free. Posts reach you as leads.", default: true, who: "Members" },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];
export type Features = Record<FeatureKey, boolean>;
export const DEFAULT_FEATURES = Object.fromEntries(FEATURES.map((f) => [f.key, f.default])) as Features;
export const isFeatureKey = (k: unknown): k is FeatureKey => typeof k === "string" && FEATURES.some((f) => f.key === k);
export const featuresOf = (stored: unknown): Features => {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  return Object.fromEntries(FEATURES.map((f) => [f.key, typeof s[f.key] === "boolean" ? (s[f.key] as boolean) : f.default])) as Features;
};
