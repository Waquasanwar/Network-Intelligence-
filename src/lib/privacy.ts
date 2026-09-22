/**
 * Consent, retention and control over a profile.
 *
 * The network holds things people told us in confidence, so the rules are written down here rather
 * than assumed: what we hold, why we are allowed to hold it, how long it stays, and what the person
 * can switch off. Two regimes apply to this network and both are respected by the stricter reading:
 *
 *  - UK GDPR and the Data Protection Act 2018 (the UK side of the network).
 *  - Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data — the UAE PDPL — which
 *    covers the Gulf side, and which is consent-first: processing generally needs consent unless a
 *    listed exception applies, and consent must be as easy to withdraw as it was to give.
 *
 * Practical consequence, and the rule this file enforces: nothing about a person is shown outside
 * the network without their consent, consent is granular, withdrawal is immediate, and every class
 * of data has a stated retention period after which it is deleted or anonymised.
 *
 * This is the mechanism, not legal advice; the periods are defaults a tenant can shorten.
 * Shared by the Next.js app and the browser prototype. No I/O.
 */

export type ConsentKey =
  | "listed"            // be in the network at all
  | "shareAnonymised"   // an anonymised capability card may be shown to a client or agency
  | "nameOnIntro"       // the name may be released when an introduction is agreed
  | "personalNotes"     // we may keep the human side: interests, motivation, how to work with them
  | "voiceProcessing"   // the screening may be spoken aloud through the platform's voice
  | "linkedin"          // we may read public recommendations to support the profile
  | "keepInTouch"       // we may contact them about work that suits them
  | "showPhoto";        // a photo may be shown — inside the network, and on an unlocked profile

export type Consents = Record<ConsentKey, boolean>;

export type ConsentDef = {
  key: ConsentKey;
  label: string;
  detail: string;
  /** What stops happening the moment it is switched off. */
  ifOff: string;
  /** Required to be in the network at all — everything else is genuinely optional. */
  required?: boolean;
};

export const CONSENTS: ConsentDef[] = [
  { key: "listed", label: "Be in the network", detail: "Your profile exists here and the team can see it. Without this there is nothing to hold, so switching it off removes you.", ifOff: "Your profile is removed and your data is deleted or anonymised within 30 days.", required: true },
  { key: "shareAnonymised", label: "Be shown to clients and agencies, anonymously", detail: "A capability card — what you do, your region, availability, work-rights status and a rate band. Never your name, employer or contact details.", ifOff: "You disappear from every client and agency view immediately, including cards already on a shortlist." },
  { key: "nameOnIntro", label: "Release my name when I agree to an introduction", detail: "Only after we have asked you about that specific role and you have said yes.", ifOff: "We will not name you at all; introductions become a conversation with us first, every time." },
  { key: "personalNotes", label: "Keep the human side of my profile", detail: "Interests, what motivates you, how you like to be worked with. It helps us put you with the right people. Internal only — a client never sees it.", ifOff: "We delete those answers and stop asking." },
  { key: "voiceProcessing", label: "Let the interviewer speak out loud", detail: "Our questions are sent to a speech provider so they can be spoken naturally. Your answers are never sent: your words become text on your own device.", ifOff: "The conversation uses your device's own voice, or you type." },
  { key: "linkedin", label: "Use my public LinkedIn recommendations", detail: "We read what is already public to support your trust profile. We never post, connect or message as you.", ifOff: "We rely only on people in the network who vouch for you." },
  { key: "keepInTouch", label: "Contact me about work that suits me", detail: "Occasional, specific, and about actual roles — never a mailshot.", ifOff: "We only contact you if you contact us first." },
  { key: "showPhoto", label: "Show my photo", detail: "Entirely optional — most profiles here have no photo at all. When it is off you appear as your initials, everywhere.", ifOff: "Your photo is deleted and your initials are used instead." },
];

/** A new person is in the network and shown anonymously; everything beyond that is opt-in. */
export const DEFAULT_CONSENTS: Consents = {
  listed: true, shareAnonymised: true, nameOnIntro: true,
  personalNotes: false, voiceProcessing: false, linkedin: false, keepInTouch: true, showPhoto: false,
};

/** A photo is never assumed. It shows inside the network only with consent, and outside only
 *  on a profile the person has agreed to unlock. */
export function canShowPhoto(p: { photoUrl?: string | null; privacy?: Partial<Privacy> | null }, audience: "internal" | "partner", unlocked = false): boolean {
  if (!p.photoUrl) return false;
  const v = privacyOf(p);
  if (!v.consents.showPhoto || v.erasureRequestedAt) return false;
  return audience === "internal" ? true : unlocked && v.consents.shareAnonymised;
}

export type Privacy = {
  consents: Consents;
  /** Fields the person chose to hide from the anonymised card even while consenting to it. */
  hideRateBand: boolean;
  hideRegion: boolean;
  /** When they last confirmed all of this, so we can ask again rather than assume forever. */
  reviewedAt: string | null;
  /** A standing erasure request, if they have made one. */
  erasureRequestedAt: string | null;
};

export const DEFAULT_PRIVACY: Privacy = { consents: { ...DEFAULT_CONSENTS }, hideRateBand: false, hideRegion: false, reviewedAt: null, erasureRequestedAt: null };

export const privacyOf = (p: { privacy?: Partial<Privacy> | null } | null | undefined): Privacy => ({
  ...DEFAULT_PRIVACY,
  ...(p?.privacy ?? {}),
  consents: { ...DEFAULT_CONSENTS, ...(p?.privacy?.consents ?? {}) },
});

// ---------- what we hold, why, and for how long ----------

export type LawfulBasis = "consent" | "legitimate interests" | "legal obligation" | "contract";

export type DataClass = {
  key: string;
  label: string;
  what: string;
  /** UK GDPR Article 6 basis. Under the PDPL the same processing runs on consent, which is why
   *  every class here either has consent or is a legal obligation we could not avoid anyway. */
  ukBasis: LawfulBasis;
  pdplBasis: "consent" | "legal obligation" | "contract";
  /** Months from the trigger. 0 means "until consent is withdrawn". */
  months: number;
  trigger: string;
  onExpiry: "delete" | "anonymise";
};

export const RETENTION: DataClass[] = [
  { key: "profile", label: "Profile", what: "Name, contact details, capabilities, availability, rate expectations, work rights.", ukBasis: "consent", pdplBasis: "consent", months: 24, trigger: "last contact with us", onExpiry: "delete" },
  { key: "screening", label: "Screening conversation", what: "Answers, the transcript of the conversation, and the summary a person approved.", ukBasis: "consent", pdplBasis: "consent", months: 24, trigger: "the conversation", onExpiry: "delete" },
  { key: "persona", label: "The human side", what: "Interests, motivation, how you like to be worked with.", ukBasis: "consent", pdplBasis: "consent", months: 24, trigger: "last contact with us", onExpiry: "delete" },
  { key: "vouches", label: "Vouches and evidence", what: "What people in the network have said they saw you deliver.", ukBasis: "legitimate interests", pdplBasis: "consent", months: 36, trigger: "the vouch", onExpiry: "anonymise" },
  { key: "shortlist", label: "Shortlists and introductions", what: "Which requirements you were proposed for, and what the client said.", ukBasis: "legitimate interests", pdplBasis: "contract", months: 24, trigger: "the requirement closing", onExpiry: "anonymise" },
  { key: "fees", label: "Fee and invoice records", what: "What was charged on a placement, and to whom.", ukBasis: "legal obligation", pdplBasis: "legal obligation", months: 84, trigger: "the invoice", onExpiry: "anonymise" },
  { key: "audit", label: "Audit log", what: "Who looked at what, and who changed it.", ukBasis: "legal obligation", pdplBasis: "legal obligation", months: 72, trigger: "the entry", onExpiry: "anonymise" },
  { key: "voice", label: "Voice", what: "Nothing. Speech becomes text on the person's own device; no audio is uploaded or stored.", ukBasis: "consent", pdplBasis: "consent", months: 0, trigger: "n/a", onExpiry: "delete" },
];

/** The rights a person has, in the words they would use, with the two regimes both covered. */
export const RIGHTS: { label: string; detail: string }[] = [
  { label: "See everything we hold", detail: "A copy of your profile, your conversation, who vouched for you and where you have been proposed. Within 30 days." },
  { label: "Correct anything wrong", detail: "Change it yourself on your profile, or ask us and we will." },
  { label: "Be deleted", detail: "We remove your profile and your conversation. Fee and audit records we are legally required to keep are anonymised instead of deleted, and we tell you which." },
  { label: "Withdraw any consent", detail: "One switch, effective immediately, and as easy to switch off as it was to switch on." },
  { label: "Restrict or object", detail: "Ask us to stop using part of your profile without deleting it — for example stay listed but never be shown to agencies." },
  { label: "Take your data elsewhere", detail: "A machine-readable export you can hand to anybody." },
  { label: "Complain", detail: "To us first, and then to the ICO in the UK or the UAE Data Office, whichever covers you." },
];

// ---------- the rules the app has to obey ----------

/** May this person appear on a client or agency card at all? */
export function canShareAnonymised(p: { privacy?: Partial<Privacy> | null }): boolean {
  const v = privacyOf(p);
  if (v.erasureRequestedAt) return false;
  return v.consents.listed && v.consents.shareAnonymised;
}

/** May we put their actual name in front of a client, given they have agreed to this introduction? */
export function canRevealName(p: { privacy?: Partial<Privacy> | null }, introductionAgreed: boolean): boolean {
  const v = privacyOf(p);
  return introductionAgreed && v.consents.listed && v.consents.nameOnIntro && !v.erasureRequestedAt;
}

/** Fields the person has chosen to keep off their anonymised card. */
export function partnerHidden(p: { privacy?: Partial<Privacy> | null }): { rateBand: boolean; region: boolean } {
  const v = privacyOf(p);
  return { rateBand: v.hideRateBand, region: v.hideRegion };
}

/** When a data class expires, given the date of its trigger. Null when it is kept until withdrawal. */
export function expiresAt(cls: DataClass, trigger: Date | string | null | undefined): Date | null {
  if (!trigger || !cls.months) return null;
  const d = typeof trigger === "string" ? new Date(trigger) : trigger;
  if (Number.isNaN(d.getTime())) return null;
  const out = new Date(d);
  out.setMonth(out.getMonth() + cls.months);
  return out;
}

export type RetentionFlag = { key: string; label: string; due: Date; action: "delete" | "anonymise" };

/**
 * What is past its retention date for this person, so it can be shown in a review queue rather
 * than quietly kept forever. Consent withdrawn is immediate and does not wait for a date.
 */
export function retentionDue(
  p: { privacy?: Partial<Privacy> | null; lastContactAt?: string | Date | null; screenedAt?: string | Date | null },
  now = new Date(),
): RetentionFlag[] {
  const out: RetentionFlag[] = [];
  const v = privacyOf(p);
  if (v.erasureRequestedAt) out.push({ key: "erasure", label: "Erasure requested", due: new Date(v.erasureRequestedAt), action: "delete" });
  for (const cls of RETENTION) {
    const trigger = cls.key === "screening" ? p.screenedAt : p.lastContactAt;
    const due = expiresAt(cls, trigger ?? null);
    if (due && due <= now) out.push({ key: cls.key, label: cls.label, due, action: cls.onExpiry });
  }
  return out;
}

/** Consent asked for once and never revisited is not consent. Ask again every twelve months. */
export function consentStale(p: { privacy?: Partial<Privacy> | null }, now = new Date()): boolean {
  const v = privacyOf(p);
  if (!v.reviewedAt) return true;
  const d = new Date(v.reviewedAt);
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return months >= 12;
}

/** A plain summary of where this person's privacy stands, for their own profile. */
export function privacySummary(p: { privacy?: Partial<Privacy> | null }): string {
  const v = privacyOf(p);
  if (v.erasureRequestedAt) return "Deletion requested — we are working through it.";
  const on = CONSENTS.filter((c) => v.consents[c.key]).length;
  const shown = v.consents.shareAnonymised ? "shown to clients anonymously" : "never shown outside the network";
  return `${on} of ${CONSENTS.length} permissions on · ${shown}`;
}
