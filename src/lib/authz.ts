import type { Role, TenantType } from "@prisma/client";

/**
 * Server-side authorisation (spec §12). Every data access goes through these helpers.
 * Partners and clients get a narrow, redacted view; relationship notes are never exposed
 * outside the owning tenant.
 */

export type Actor = {
  id: string;
  tenantId: string;
  role: Role;
  tenantType: TenantType;
};

export class AuthorizationError extends Error {
  constructor(message = "Not permitted") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export const INTERNAL_ROLES: Role[] = ["OWNER", "ADMIN", "CONTRIBUTOR"];

export function isInternal(actor: Actor) {
  return INTERNAL_ROLES.includes(actor.role) && actor.tenantType !== "RECRUITMENT_PARTNER" && actor.tenantType !== "DIRECT_CLIENT";
}

export function isMember(actor: Actor) {
  return actor.role === "MEMBER";
}

export function isPartner(actor: Actor) {
  return actor.role === "PARTNER" || actor.tenantType === "RECRUITMENT_PARTNER";
}

export function isClient(actor: Actor) {
  return actor.role === "CLIENT" || actor.tenantType === "DIRECT_CLIENT";
}

export function canManageUsers(actor: Actor) {
  return actor.role === "OWNER" || actor.role === "ADMIN";
}

export function canApprove(actor: Actor) {
  // Recommendations and introductions are approved by internal humans only.
  return isInternal(actor);
}

export function canRevealIdentity(actor: Actor) {
  return actor.role === "OWNER" || actor.role === "ADMIN";
}

export function canViewRelationshipNotes(actor: Actor, recordTenantId: string) {
  return isInternal(actor) && actor.tenantId === recordTenantId;
}

export function assertInternal(actor: Actor) {
  if (!isInternal(actor)) throw new AuthorizationError("Internal access required");
}

export function assertSameTenant(actor: Actor, recordTenantId: string) {
  if (actor.tenantId !== recordTenantId) throw new AuthorizationError("Cross-tenant access denied");
}

/** Pages each role may navigate to. Enforced in the layout and in the middleware. */
export function allowedPaths(actor: Actor): string[] {
  if (isPartner(actor)) return ["/partner-portal", "/portal", "/settings/security"];
  if (isClient(actor)) return ["/client-workspace", "/portal", "/settings/security"];
  if (actor.role === "MEMBER") return ["/member", "/screening", "/settings/security"];
  return ["/overview", "/network", "/conversations", "/opportunities", "/requirements", "/referrals", "/portal", "/member", "/screening", "/amana", "/partners", "/relocation", "/settings"];
}

export function canAccessPath(actor: Actor, pathname: string) {
  return allowedPaths(actor).some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ---------- Partner-safe redaction ----------

export type PersonFull = {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  headline?: string | null;
  currentCompany?: string | null;
  currentRole?: string | null;
  primaryCity?: string | null;
  primaryCountry?: string | null;
  capabilities: string[];
  sectors: string[];
  seniority?: string | null;
  engagementPreferences: string[];
  availabilityStatus: string;
  relationships?: { relationshipNotes?: string | null; [k: string]: unknown }[];
  evidence?: { description: string; visibility: string; evidenceType: string; context: string; [k: string]: unknown }[];
  conversations?: unknown[];
};

export type PartnerSafePerson = {
  ref: string; // opaque reference, not the database id
  headlineSummary: string;
  capabilities: string[];
  sectors: string[];
  seniority: string | null;
  engagementPreferences: string[];
  region: string | null;
  availabilityBand: "near-term" | "selective" | "not-now" | "unknown";
  evidenceSummary: string;
};

function availabilityBand(status: string): PartnerSafePerson["availabilityBand"] {
  if (["AVAILABLE_NOW", "OPEN_TO_CONVERSATIONS", "FINISHING_ENGAGEMENT_SOON", "FRACTIONAL_AVAILABILITY"].includes(status)) return "near-term";
  if (["QUIETLY_EXPLORING", "RIGHT_OPPORTUNITY_ONLY", "SOW_ONLY", "PERMANENT_ONLY", "CONTRACT_ONLY"].includes(status)) return "selective";
  if (status === "NEEDS_REFRESH") return "unknown";
  return "not-now";
}

/** Stable opaque reference so a partner can talk about "NI-4F2A" without learning an id. */
export function opaqueRef(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return "NI-" + h.toString(16).toUpperCase().padStart(6, "0").slice(-6);
}

/**
 * Produce the only representation of a person a recruitment partner may ever see before an
 * approved identity reveal. No name, contact details, employer, notes, or evidence text.
 */
export function redactForPartner(p: PersonFull): PartnerSafePerson {
  const positive = (p.evidence ?? []).filter((e) => e.evidenceType !== "CAUTION");
  const partnerSafe = positive.filter((e) => e.visibility === "PARTNER_SAFE");
  const evidenceSummary =
    positive.length === 0
      ? "No delivery evidence recorded."
      : `${positive.length} piece${positive.length === 1 ? "" : "s"} of observed delivery evidence${partnerSafe.length ? ` (${partnerSafe.length} shareable on request)` : ""}.`;
  return {
    ref: opaqueRef(p.id),
    headlineSummary: [p.seniority ? p.seniority.replace(/_/g, " ").toLowerCase() : null, p.capabilities.slice(0, 3).join(", ")]
      .filter(Boolean)
      .join(" · "),
    capabilities: [...p.capabilities],
    sectors: [...p.sectors],
    seniority: p.seniority ?? null,
    engagementPreferences: [...p.engagementPreferences],
    region: p.primaryCountry ?? null,
    availabilityBand: availabilityBand(p.availabilityStatus),
    evidenceSummary,
  };
}

const FORBIDDEN_PARTNER_KEYS = [
  "id",
  "tenantId",
  "firstName",
  "lastName",
  "preferredName",
  "email",
  "phone",
  "linkedinUrl",
  "currentCompany",
  "currentRole",
  "primaryCity",
  "relationshipNotes",
  "relationships",
  "conversations",
  "evidence",
  "description",
  "transcript",
  "rawNotes",
];

/** Defensive check used by tests and by the partner API boundary. */
export function containsForbiddenPartnerFields(payload: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (FORBIDDEN_PARTNER_KEYS.includes(k)) found.add(k);
        walk(val);
      }
    }
  };
  walk(payload);
  return [...found];
}
