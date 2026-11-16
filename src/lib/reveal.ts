/**
 * When a person's name may be shown outside the network. One definition, used by the actions that
 * move an introduction forward and by every page a client or agency can open, so the two can never
 * disagree about what "revealed" means.
 *
 * Three things must all be true: the introduction has reached a naming stage, the person has said
 * yes to this introduction, and they have not since withdrawn the permission or asked to be deleted.
 */
import { canRevealName, canShareAnonymised, type Privacy } from "@/lib/privacy";

type Holder = { privacy?: Partial<Privacy> | unknown | null; referralConsent?: string | null };
const asHolder = (p: Holder) => ({ privacy: (p.privacy && typeof p.privacy === "object" ? p.privacy : null) as Partial<Privacy> | null });

/** Introduction stages (opportunity flow) at which the client or agency is given the name. */
export const INTRO_NAMING_STATUSES = ["IDENTITY_REVEALED", "INTRODUCED", "IN_PROGRESS", "ENGAGED"] as const;
/** Shortlist decisions (requirement flow) at which the client or agency is given the name. */
export const SHORTLIST_NAMING_DECISIONS = ["INTRODUCED", "PLACED"] as const;

export const isIntroNamingStatus = (s: string) => (INTRO_NAMING_STATUSES as readonly string[]).includes(s);
export const isShortlistNamingDecision = (s: string) => (SHORTLIST_NAMING_DECISIONS as readonly string[]).includes(s);

/** May this person appear on an anonymised card at all? Off the radar, withdrawn or deleting → no. */
export function mayShowCard(p: Holder): boolean {
  return p.referralConsent !== "no" && canShareAnonymised(asHolder(p));
}

/** Has the person's standing permission to be named been withdrawn (or never given)? */
export function namingBlocked(p: Holder): string | null {
  if (p.referralConsent === "no") return "They have asked not to be put forward.";
  if (!canRevealName(asHolder(p), true)) return "They have switched off sharing their name, or asked to be deleted.";
  return null;
}

/** Opportunity flow: is the name visible to the partner or client for this introduction? */
export function introNameVisible(intro: { status: string; consentStatus: string }, person: Holder): boolean {
  return isIntroNamingStatus(intro.status) && intro.consentStatus === "GRANTED" && namingBlocked(person) === null;
}

/** Requirement flow: is the name visible on this shortlist card? */
export function shortlistNameVisible(item: { decision: string }, person: Holder): boolean {
  return isShortlistNamingDecision(item.decision) && namingBlocked(person) === null;
}
