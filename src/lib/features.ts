/**
 * What the owner has released. Nothing reaches members, clients, agencies or the public until the
 * owner switches it on in Settings → Release, and anything can be paused again at once. Every
 * switch is off by default. Stored on the network's tenant; anything not set is off.
 *
 * Always available, whatever is switched: Privacy & data and Security for anyone with an account
 * (their legal rights), and joining from an invitation the owner sends.
 */
export const AUDIENCES = ["Members", "Clients", "Agencies", "Public"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const FEATURES = [
  { key: "memberArea", who: "Members", label: "Member area", detail: "Members sign in to their own page: their availability, what the agent tells them and asks them, and their part of the network. Off: they see a short note that it is not open yet, and their privacy and security settings." },
  { key: "memberScreening", who: "Members", label: "Self-serve screening", requires: "memberArea", detail: "Members take the 15-minute screening conversation on their own. Off: screening happens with you, on a call." },
  { key: "readAloud", who: "Members", label: "Read screening questions aloud", requires: "memberScreening", detail: "A ‘Hear the question’ button on each screening question: the natural voice where a member has agreed to it, otherwise their device's own voice." },
  { key: "memberReferrals", who: "Members", label: "Refer and invite", requires: "memberArea", detail: "Members refer people they know for work and send invitations to join. Everyone they bring in is screened as usual." },
  { key: "communityBoard", who: "Members", label: "Community feed", requires: "memberArea", detail: "Members share work they hear about, ask for a specialist, or say they are free. Work posted here reaches you as a lead." },
  { key: "memberConnections", who: "Members", label: "People and messages", requires: "memberArea", detail: "Members who choose to be seen can find each other, connect, and message privately. Contact details are shared only when both say yes." },
  { key: "memberPhotos", who: "Members", label: "Members' own photos", requires: "memberArea", detail: "Members can add a photo of themselves. It shows inside the network only, never on an anonymised client card." },
  { key: "earnings", who: "Members", label: "Earnings for members", requires: "memberArea", detail: "Members see their share of placements and the referral percentage. Credits are recorded either way, so nothing is lost while it is off." },
  { key: "clientPortal", who: "Clients", label: "Client portal", detail: "Clients sign in to see their requirements, where each stands, and the anonymised people put forward, and to raise new needs. Search for each client is switched on per account." },
  { key: "agencyPortal", who: "Agencies", label: "Agency portal", detail: "Agencies sign in to see the requirements they share with you and the people introduced against them." },
  { key: "publicApplications", who: "Public", label: "Applications on the public page", detail: "Anyone can apply to join or describe who they need on the public page. Off: the page says Amana Network is by invitation, with a way to sign in." },
] as const satisfies readonly { key: string; who: Audience; label: string; detail: string; requires?: string }[];

export type FeatureKey = (typeof FEATURES)[number]["key"];
export type Features = Record<FeatureKey, boolean>;
export const DEFAULT_FEATURES = Object.fromEntries(FEATURES.map((f) => [f.key, false])) as Features;
export const isFeatureKey = (k: unknown): k is FeatureKey => typeof k === "string" && FEATURES.some((f) => f.key === k);

/**
 * The switches as they take effect. A feature that depends on another (the feed on the member area,
 * reading aloud on screening) is only live while what it depends on is live too.
 */
export const featuresOf = (stored: unknown): Features => {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const raw = Object.fromEntries(FEATURES.map((f) => [f.key, s[f.key] === true])) as Features;
  const live = (k: FeatureKey): boolean => {
    const f = FEATURES.find((x) => x.key === k)!;
    return raw[k] && (!("requires" in f) || live(f.requires as FeatureKey));
  };
  return Object.fromEntries(FEATURES.map((f) => [f.key, live(f.key)])) as Features;
};

/** The switches exactly as the owner set them, before dependencies: for the settings page. */
export const storedFeaturesOf = (stored: unknown): Features => {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  return Object.fromEntries(FEATURES.map((f) => [f.key, s[f.key] === true])) as Features;
};
