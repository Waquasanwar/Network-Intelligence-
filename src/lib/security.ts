/**
 * Security, stated as controls rather than claims.
 *
 * "Secure by design" means the safe thing is what happens when nobody configures anything, and the
 * unsafe thing takes a deliberate act. So this file holds two different kinds of thing and keeps
 * them apart, because conflating them is how a security page becomes marketing:
 *
 *  - PROPERTIES are true of the build. Nobody can switch them off from the interface, and they are
 *    listed so a client's security reviewer can see what they are getting. Each one names the
 *    mechanism in the codebase that enforces it, so the claim is checkable.
 *  - CONTROLS are switches a tenant owner actually operates. Each has a default, and the default is
 *    the safe setting — that is the whole of "by default". Each says plainly what turning it off
 *    costs, because a switch with no stated consequence is a trap.
 *
 * The two regimes this network sits under — UK GDPR / DPA 2018 and the UAE PDPL (Federal
 * Decree-Law No. 45 of 2021) — both require data protection by design and by default, so the
 * relevant article is named against each item rather than gestured at.
 *
 * This is the mechanism, not legal advice. Shared by the Next.js app and the browser prototype.
 * No I/O.
 */

export type Regime = "UK GDPR" | "PDPL" | "both";

// ---------- what is true of the build ----------

export type SecurityProperty = {
  key: string;
  label: string;
  /** The principle, in the words a security reviewer would use. */
  principle: string;
  /** How it is actually enforced. Names the mechanism so the claim can be checked. */
  how: string;
  /** Where in the codebase, so a reviewer can go and look. */
  where: string;
  basis: Regime;
  article: string;
};

export const SECURITY_PROPERTIES: SecurityProperty[] = [
  {
    key: "tenancy",
    label: "Tenant isolation",
    principle: "One organisation's network is never visible to another, and never pooled for matching.",
    how: "Every query is scoped to the tenant on the session, and writes assert the record's tenant matches the actor's before they run.",
    where: "assertSameTenant() in src/lib/authz.ts",
    basis: "both",
    article: "UK GDPR Art. 32(1)(b) · PDPL Art. 20",
  },
  {
    key: "rbac",
    label: "Least privilege",
    principle: "Nobody holds a permission their job does not need, and the check runs on the server.",
    how: "Roles are owner, admin and contributor inside the tenant; partners, clients and experts are separate actors with their own allowed paths. Every sensitive route re-checks rather than trusting the interface.",
    where: "canAccessPath(), assertInternal(), canRevealIdentity() in src/lib/authz.ts",
    basis: "both",
    article: "UK GDPR Art. 32(1)(b)",
  },
  {
    key: "redaction",
    label: "Anonymous by default, outward",
    principle: "A client or agency sees capability, never identity, until the person agrees to that specific role.",
    how: "Anything leaving the tenant passes through a redactor that builds a partner-safe record from an allowlist of fields, and a second check refuses a payload that still contains a forbidden one.",
    where: "redactForPartner(), containsForbiddenPartnerFields() in src/lib/authz.ts",
    basis: "both",
    article: "UK GDPR Art. 25(2) · PDPL Art. 6",
  },
  {
    key: "refs",
    label: "Opaque references outward",
    principle: "An identifier shown outside the tenant cannot be walked back to a record or counted.",
    how: "Internal ids are never sent to a partner surface; a derived opaque reference is used instead.",
    where: "opaqueRef() in src/lib/authz.ts",
    basis: "both",
    article: "UK GDPR Art. 32(1)(a)",
  },
  {
    key: "minimisation",
    label: "Data minimisation",
    principle: "We hold what changes a decision and nothing that merely feels useful.",
    how: "The screening records the right to work, which affects whether somebody can take a job, and never nationality, which does not. No audio is captured: speech becomes text on the person's own device.",
    where: "src/lib/screening.ts · src/lib/voice-config.ts",
    basis: "both",
    article: "UK GDPR Art. 5(1)(c) · PDPL Art. 5",
  },
  {
    key: "purpose",
    label: "Purpose limitation",
    principle: "Consent to one introduction is not consent to the next one.",
    how: "Releasing a name requires consent recorded against that requirement. Withdrawal takes effect on the next read, including for cards already sitting on a client's shortlist.",
    where: "canRevealName(), canShareAnonymised() in src/lib/privacy.ts",
    basis: "both",
    article: "UK GDPR Art. 5(1)(b) · PDPL Art. 5",
  },
  {
    key: "audit",
    label: "Accountability",
    principle: "Every action that touches somebody's identity or money is recorded and cannot be edited from the interface.",
    how: "A typed action list, written on the server at the point the action succeeds, with actor, entity and detail.",
    where: "audit() in src/lib/audit.ts",
    basis: "both",
    article: "UK GDPR Art. 5(2) · PDPL Art. 8",
  },
  {
    key: "transit",
    label: "Encryption in transit and at rest",
    principle: "Nothing travels or sits in the clear.",
    how: "TLS on every connection; the database and its backups are encrypted at rest by the platform.",
    where: "Platform configuration",
    basis: "both",
    article: "UK GDPR Art. 32(1)(a) · PDPL Art. 20",
  },
  {
    key: "vendor",
    label: "A stated vendor boundary",
    principle: "You can see exactly what leaves the platform, and answers never do.",
    how: "Only the interviewer's own questions are sent for speech, with names and exact figures removed first. The vendor key stays on the server and is never handed to a browser.",
    where: "redactForSpeech() in src/lib/voice-config.ts · src/app/api/voice/*",
    basis: "both",
    article: "UK GDPR Art. 28 · PDPL Art. 10",
  },
  {
    key: "rights",
    label: "Erasure and portability are buttons",
    principle: "A person's rights are something they exercise, not something they request.",
    how: "Export produces a machine-readable copy; erasure removes the profile and conversation, anonymising only the fee and audit records the law requires us to keep, and says which.",
    where: "src/lib/privacy.ts · the expert's own profile",
    basis: "both",
    article: "UK GDPR Arts. 17, 20 · PDPL Arts. 13, 15",
  },
];

// ---------- what an owner actually switches ----------

export type SecurityControlKey =
  | "mfaRequired"
  | "approveBeforeReveal"
  | "restrictExport"
  | "notesStayInternal"
  | "autoRedactSpeech"
  | "retentionSweep"
  | "sessionTimeout"
  | "alertOnReveal";

export type SecurityControl = {
  key: SecurityControlKey;
  label: string;
  /** What switching it on does, in the present tense. */
  does: string;
  /** What it costs to switch off. A control with no stated consequence is a trap. */
  ifOff: string;
  /** The safe setting, which is what a new tenant gets. */
  defaultOn: boolean;
  /** Turning this off weakens a protection materially, so the interface warns. */
  weakensIfOff: boolean;
  group: "identity" | "disclosure" | "retention";
};

export const SECURITY_CONTROLS: SecurityControl[] = [
  {
    key: "mfaRequired", label: "Require a second factor to sign in", group: "identity",
    does: "Everybody in your tenant sets up an authenticator before they can open the network again.",
    ifOff: "A leaked password is enough to read every profile you hold.",
    defaultOn: true, weakensIfOff: true,
  },
  {
    key: "sessionTimeout", label: "Sign people out after 12 hours idle", group: "identity",
    does: "A session that has not been used for half a day has to be started again.",
    ifOff: "An unlocked laptop stays signed in indefinitely.",
    defaultOn: true, weakensIfOff: false,
  },
  {
    key: "approveBeforeReveal", label: "An owner approves every identity reveal", group: "disclosure",
    does: "A contributor can propose anybody, but releasing a name to a client waits for you.",
    ifOff: "Any contributor can release a name once the person has consented.",
    defaultOn: true, weakensIfOff: true,
  },
  {
    key: "alertOnReveal", label: "Tell me whenever a name is released", group: "disclosure",
    does: "You get a notification the moment an identity is revealed, with who did it and to whom.",
    ifOff: "Reveals are still recorded in the audit log, but nobody is told at the time.",
    defaultOn: true, weakensIfOff: false,
  },
  {
    key: "restrictExport", label: "Only owners can export", group: "disclosure",
    does: "Bulk export of people or shortlists is limited to owners, and every export is recorded with what was in it.",
    ifOff: "Any contributor can take a copy of the network with them.",
    defaultOn: true, weakensIfOff: true,
  },
  {
    key: "notesStayInternal", label: "Private notes never leave the tenant", group: "disclosure",
    does: "Relationship notes are stripped from anything shown to a client, an agency or the person themselves.",
    ifOff: "Notes written in confidence could appear on a shared profile.",
    defaultOn: true, weakensIfOff: true,
  },
  {
    key: "autoRedactSpeech", label: "Redact names and figures before speech", group: "disclosure",
    does: "The interviewer's questions have names and exact money removed before they reach the speech vendor.",
    ifOff: "A name or a day rate could be spoken to a third-party service.",
    defaultOn: true, weakensIfOff: true,
  },
  {
    key: "retentionSweep", label: "Delete data when its retention period ends", group: "retention",
    does: "Anything past its stated retention date is deleted or anonymised on a monthly sweep, and you get the list first.",
    ifOff: "Data is kept until somebody deletes it by hand, which is the easiest promise to break.",
    defaultOn: true, weakensIfOff: true,
  },
];

export type SecuritySettings = Record<SecurityControlKey, boolean>;

/** A new tenant is secure without configuring anything. That is what "by default" means. */
export const DEFAULT_SECURITY: SecuritySettings = SECURITY_CONTROLS.reduce((acc, c) => {
  acc[c.key] = c.defaultOn;
  return acc;
}, {} as SecuritySettings);

export const securityOf = (s?: Partial<SecuritySettings> | null): SecuritySettings => ({ ...DEFAULT_SECURITY, ...(s ?? {}) });

/** Actions that are always recorded, whatever else is switched off. */
export const SENSITIVE_ACTIONS: { action: string; what: string }[] = [
  { action: "identity.reveal", what: "A name was released to a client or agency" },
  { action: "introduction.approve", what: "An introduction was approved" },
  { action: "summary.approve", what: "A conversation summary was approved onto a profile" },
  { action: "person.export", what: "Somebody took a copy of a person's record" },
  { action: "user.role_change", what: "A permission was granted or removed" },
  { action: "integration.connect", what: "A calendar or scheduling account was connected" },
  { action: "data.deletion_request", what: "An erasure was requested" },
  { action: "auth.login", what: "Somebody signed in" },
];

// ---------- where the tenant actually stands ----------

export type PostureFinding = { key: SecurityControlKey; label: string; ifOff: string; severity: "weakened" | "relaxed" };

export type Posture = {
  /** Controls on, out of the total. Not a score out of 100 — that would invite gaming. */
  on: number;
  total: number;
  /** Switched-off controls that materially weaken a protection. */
  weakened: PostureFinding[];
  /** Switched-off controls that are a matter of preference. */
  relaxed: PostureFinding[];
  band: "secure by default" | "hardened below default" | "relaxed";
  line: string;
};

/**
 * The state of the tenant's own controls, said plainly. A tenant that has changed nothing is in the
 * best state there is, so that is what the page says — rather than inventing a score it can climb.
 */
export function posture(settings?: Partial<SecuritySettings> | null): Posture {
  const v = securityOf(settings);
  const off = SECURITY_CONTROLS.filter((c) => !v[c.key]);
  const weakened = off.filter((c) => c.weakensIfOff).map((c) => ({ key: c.key, label: c.label, ifOff: c.ifOff, severity: "weakened" as const }));
  const relaxed = off.filter((c) => !c.weakensIfOff).map((c) => ({ key: c.key, label: c.label, ifOff: c.ifOff, severity: "relaxed" as const }));
  const on = SECURITY_CONTROLS.length - off.length;
  const band: Posture["band"] = weakened.length ? "hardened below default" : relaxed.length ? "relaxed" : "secure by default";
  const line = weakened.length
    ? `${weakened.length} protection${weakened.length === 1 ? " is" : "s are"} switched off below the default. ${weakened[0].ifOff}`
    : relaxed.length
      ? `Every protection that matters is on. ${relaxed.length} convenience setting${relaxed.length === 1 ? " is" : "s are"} off.`
      : "Everything is at its default, and the default is the safe setting. Nothing here needs your attention.";
  return { on, total: SECURITY_CONTROLS.length, weakened, relaxed, band, line };
}

/** Group the controls for display, in the order an owner thinks about them. */
export const CONTROL_GROUPS: { key: SecurityControl["group"]; label: string; note: string }[] = [
  { key: "identity", label: "Who can get in", note: "Signing in, and staying signed in." },
  { key: "disclosure", label: "What can get out", note: "Every route by which something about a person leaves this tenant." },
  { key: "retention", label: "What we stop holding", note: "Keeping data no longer than we said we would." },
];
