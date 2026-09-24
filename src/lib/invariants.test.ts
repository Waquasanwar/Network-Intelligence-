/**
 * The invariants. Not unit tests of a function's arithmetic — the promises the product makes,
 * asserted so that breaking one fails the build.
 *
 * These exist because everything in this platform rests on four claims: that a client cannot see a
 * name, that consent withdrawn takes effect at once, that a role cannot reach a page it should not,
 * and that the safe setting is the default. Each of those is stated in the interface, written into
 * the contract an account signs, and published in the privacy pages. So each one is tested here,
 * adversarially, against the real functions — including the round-trip check that scans a redacted
 * payload for the person's actual name rather than trusting the shape of the object.
 */
import { describe, it, expect } from "vitest";
import {
  allowedPaths, canAccessPath, canRevealIdentity, canManageUsers, canViewRelationshipNotes,
  containsForbiddenPartnerFields, isInternal, opaqueRef, redactForPartner, assertSameTenant,
  AuthorizationError, type Actor, type PersonFull,
} from "./authz";
import {
  CONSENTS, DEFAULT_CONSENTS, RETENTION, canRevealName, canShareAnonymised, canShowPhoto,
  consentStale, privacyOf, retentionDue,
} from "./privacy";
import { DEFAULT_SECURITY, SECURITY_CONTROLS, SENSITIVE_ACTIONS } from "./security";
import { redactForSpeech } from "./voice-config";

const actor = (role: Actor["role"], tenantType: Actor["tenantType"], tenantId = "t-amana"): Actor =>
  ({ id: "u-1", tenantId, role, tenantType } as Actor);

const OWNER = actor("OWNER", "PLATFORM_OWNER");
const CONTRIBUTOR = actor("CONTRIBUTOR", "PLATFORM_OWNER");
const PARTNER = actor("PARTNER", "RECRUITMENT_PARTNER", "t-harbour");
const CLIENT = actor("CLIENT", "DIRECT_CLIENT", "t-clienta");
const MEMBER = actor("MEMBER", "PLATFORM_OWNER");

/** Every page an internal user can reach. Anything added here must be re-checked against outsiders. */
const INTERNAL_ONLY = ["/overview", "/network", "/conversations", "/opportunities", "/requirements", "/referrals", "/amana", "/partners", "/relocation", "/settings"];

// ---------------------------------------------------------------- access

describe("INVARIANT · a role cannot reach a page it has no business on", () => {
  it.each([["partner", PARTNER], ["client", CLIENT], ["member", MEMBER]] as const)(
    "%s is refused every internal page, including deep links", (_name, who) => {
      for (const p of INTERNAL_ONLY) {
        expect(canAccessPath(who, p), `${p} should be refused`).toBe(false);
        expect(canAccessPath(who, `${p}/some-id`), `${p}/:id should be refused`).toBe(false);
        expect(canAccessPath(who, `${p}/some-id/edit`), `${p}/:id/edit should be refused`).toBe(false);
      }
    },
  );

  it("does not let a prefix collision open a door", () => {
    // "/member" is allowed for a member; "/members-export" must not ride in on it.
    expect(canAccessPath(MEMBER, "/member")).toBe(true);
    expect(canAccessPath(MEMBER, "/members-export")).toBe(false);
    expect(canAccessPath(PARTNER, "/portal")).toBe(true);
    expect(canAccessPath(PARTNER, "/portal-admin")).toBe(false);
  });

  it("keeps a client and a partner out of each other's workspace", () => {
    expect(canAccessPath(CLIENT, "/partner-portal")).toBe(false);
    expect(canAccessPath(PARTNER, "/client-workspace")).toBe(false);
  });

  it("gives every actor their own security page and nothing more of settings", () => {
    for (const who of [PARTNER, CLIENT, MEMBER]) {
      expect(canAccessPath(who, "/settings/security")).toBe(true);
      expect(canAccessPath(who, "/settings/commercials")).toBe(false);
      expect(canAccessPath(who, "/settings")).toBe(false);
    }
  });

  it("refuses an unknown path rather than defaulting open", () => {
    for (const who of [OWNER, PARTNER, CLIENT, MEMBER]) {
      expect(canAccessPath(who, "/../etc/passwd")).toBe(false);
      expect(canAccessPath(who, "/totally-made-up")).toBe(false);
      expect(canAccessPath(who, "")).toBe(false);
    }
  });

  it("reserves the acts that disclose or escalate", () => {
    expect(canRevealIdentity(OWNER)).toBe(true);
    expect(canManageUsers(OWNER)).toBe(true);
    for (const who of [PARTNER, CLIENT, MEMBER]) {
      expect(canRevealIdentity(who)).toBe(false);
      expect(canManageUsers(who)).toBe(false);
      expect(isInternal(who)).toBe(false);
    }
  });

  it("never lets one tenant touch another's record", () => {
    expect(() => assertSameTenant(OWNER, "t-amana")).not.toThrow();
    expect(() => assertSameTenant(OWNER, "t-clienta")).toThrow(AuthorizationError);
    expect(() => assertSameTenant(CLIENT, "t-amana")).toThrow(AuthorizationError);
  });

  it("keeps private relationship notes inside the tenant that wrote them", () => {
    expect(canViewRelationshipNotes(OWNER, "t-amana")).toBe(true);
    expect(canViewRelationshipNotes(OWNER, "t-clienta")).toBe(false);
    expect(canViewRelationshipNotes(CLIENT, "t-clienta")).toBe(false);
  });

  it("has no path an outsider can reach that an owner cannot", () => {
    const owner = allowedPaths(OWNER);
    for (const who of [PARTNER, CLIENT, MEMBER]) {
      for (const p of allowedPaths(who)) {
        if (p === "/partner-portal" || p === "/client-workspace" || p === "/settings/security") continue;
        expect(owner.some((o) => p === o || p.startsWith(o + "/")), `owner cannot reach ${p}`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------- redaction

const FULL: PersonFull = {
  id: "p-sarah",
  firstName: "Sarah", lastName: "Okonkwo",
  email: "sarah.okonkwo@example.com", phone: "+971 50 123 4567",
  linkedinUrl: "https://linkedin.com/in/sarahokonkwo",
  photoUrl: "https://example.com/sarah.jpg",
  headline: "Programme director who stabilises troubled transformations",
  currentCompany: "Northwind Bank", currentRole: "Programme Director",
  primaryCity: "London", primaryCountry: "UK",
  capabilities: ["Programme director", "Transformation"], sectors: ["Banking"],
  seniority: "DIRECTOR", engagementPreferences: ["INTERIM"],
  availabilityStatus: "AVAILABLE_NOW", rateExpectation: "£1,350/day",
  tenantId: "t-amana",
  relationships: [{ relationshipNotes: "Met through Richard; do not approach her current employer.", workedTogether: true } as never],
  evidence: [{ evidenceType: "DELIVERY", visibility: "TENANT", description: "Rebuilt the plan at Northwind" } as never],
} as unknown as PersonFull;

describe("INVARIANT · nothing that identifies a person crosses the boundary", () => {
  const safe = redactForPartner(FULL);
  const json = JSON.stringify(safe);

  it("carries no forbidden key", () => {
    expect(containsForbiddenPartnerFields(safe)).toEqual([]);
  });

  it("does not contain the person's actual details anywhere in the payload", () => {
    // The shape check above can pass while a value leaks through a differently-named field, so
    // this scans the serialised output for the real strings.
    for (const secret of ["Sarah", "Okonkwo", "sarah.okonkwo@example.com", "+971 50 123 4567", "linkedin.com/in/sarahokonkwo", "Northwind", "sarah.jpg", "do not approach"]) {
      expect(json, `leaked: ${secret}`).not.toContain(secret);
    }
  });

  it("still carries enough to make a decision on", () => {
    expect(safe.ref).toMatch(/^NI-[0-9A-F]{6}$/);
    expect(safe.headlineSummary).toContain("Programme director");
    expect(json).toContain("Banking");
  });

  it("catches a payload somebody assembled by hand", () => {
    expect(containsForbiddenPartnerFields({ nested: [{ deep: { email: "x@y.z" } }] })).toContain("email");
    expect(containsForbiddenPartnerFields({ a: { b: { relationshipNotes: "..." } } })).toContain("relationshipNotes");
  });

  it("gives a reference that cannot be walked back to the record", () => {
    expect(opaqueRef("p-sarah")).not.toContain("sarah");
    expect(opaqueRef("p-sarah")).toBe(opaqueRef("p-sarah"));
    expect(opaqueRef("p-sarah")).not.toBe(opaqueRef("p-marcus"));
  });
});

// ---------------------------------------------------------------- consent

describe("INVARIANT · consent decides, and withdrawal is immediate", () => {
  const listed = { privacy: { consents: { ...DEFAULT_CONSENTS } } };

  it("shows nobody outside the network who has not agreed to it", () => {
    expect(canShareAnonymised(listed)).toBe(true);
    expect(canShareAnonymised({ privacy: { consents: { ...DEFAULT_CONSENTS, shareAnonymised: false } } })).toBe(false);
    expect(canShareAnonymised({ privacy: { consents: { ...DEFAULT_CONSENTS, listed: false } } })).toBe(false);
  });

  it("stops sharing the moment an erasure is requested, whatever the consents say", () => {
    expect(canShareAnonymised({ privacy: { consents: { ...DEFAULT_CONSENTS }, erasureRequestedAt: new Date().toISOString() } })).toBe(false);
  });

  it("takes effect with no cache — the same object, flipped, gives the opposite answer", () => {
    const p = { privacy: { consents: { ...DEFAULT_CONSENTS } } };
    expect(canShareAnonymised(p)).toBe(true);
    p.privacy.consents.shareAnonymised = false;
    expect(canShareAnonymised(p)).toBe(false);
  });

  it("never releases a name without both the consent and the agreement to this role", () => {
    expect(canRevealName(listed, true)).toBe(true);
    expect(canRevealName(listed, false)).toBe(false);
    expect(canRevealName({ privacy: { consents: { ...DEFAULT_CONSENTS, nameOnIntro: false } } }, true)).toBe(false);
    expect(canRevealName({ privacy: { consents: { ...DEFAULT_CONSENTS }, erasureRequestedAt: "2026-01-01" } }, true)).toBe(false);
  });

  it("keeps photos off unless somebody chose otherwise", () => {
    expect(DEFAULT_CONSENTS.showPhoto).toBe(false);
    const withPhoto = { photoUrl: "x.jpg", privacy: { consents: { ...DEFAULT_CONSENTS } } };
    expect(canShowPhoto(withPhoto, "internal")).toBe(false);
    const agreed = { photoUrl: "x.jpg", privacy: { consents: { ...DEFAULT_CONSENTS, showPhoto: true } } };
    expect(canShowPhoto(agreed, "internal")).toBe(true);
    expect(canShowPhoto(agreed, "partner")).toBe(false);          // not outside, unless unlocked
    expect(canShowPhoto(agreed, "partner", true)).toBe(true);
  });

  it("keeps the human notes opt-in, because a client is not entitled to them", () => {
    expect(DEFAULT_CONSENTS.personalNotes).toBe(false);
    expect(DEFAULT_CONSENTS.voiceProcessing).toBe(false);
    expect(DEFAULT_CONSENTS.linkedin).toBe(false);
  });

  it("makes only being in the network compulsory; everything else is genuinely optional", () => {
    const required = CONSENTS.filter((c) => c.required).map((c) => c.key);
    expect(required).toEqual(["listed"]);
    for (const c of CONSENTS) expect(c.ifOff.length, `${c.key} does not say what switching it off does`).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------- retention

describe("INVARIANT · nothing is kept longer than we said", () => {
  const longAgo = new Date(Date.now() - 1000 * 86_400_000).toISOString();

  it("flags data past its stated period", () => {
    const due = retentionDue({ privacy: {}, lastContactAt: longAgo, screenedAt: longAgo });
    expect(due.length).toBeGreaterThan(0);
    for (const d of due) expect(["delete", "anonymise"]).toContain(d.action);
  });

  it("flags an erasure request straight away", () => {
    const due = retentionDue({ privacy: { erasureRequestedAt: new Date().toISOString() } });
    expect(due[0].key).toBe("erasure");
    expect(due[0].action).toBe("delete");
  });

  it("re-asks for consent that has not been checked in a year", () => {
    expect(consentStale({ privacy: { reviewedAt: null } })).toBe(true);
    expect(consentStale({ privacy: { reviewedAt: longAgo } })).toBe(true);
    expect(consentStale({ privacy: { reviewedAt: new Date().toISOString() } })).toBe(false);
  });

  it("gives every class a basis under both regimes and an end state", () => {
    for (const c of RETENTION) {
      expect(c.ukBasis, `${c.key} has no UK basis`).toBeTruthy();
      expect(c.pdplBasis, `${c.key} has no PDPL basis`).toBeTruthy();
      expect(["delete", "anonymise"]).toContain(c.onExpiry);
    }
  });

  it("stores no audio at all", () => {
    const voice = RETENTION.find((c) => c.key === "voice")!;
    expect(voice.months).toBe(0);
    expect(voice.what).toMatch(/no audio is uploaded or stored/i);
  });
});

// ---------------------------------------------------------------- defaults & vendor

describe("INVARIANT · the safe setting is what happens when nobody configures anything", () => {
  it("ships every security control on", () => {
    expect(SECURITY_CONTROLS.every((c) => c.defaultOn)).toBe(true);
    expect(Object.values(DEFAULT_SECURITY).every(Boolean)).toBe(true);
  });

  it("records the acts that disclose, escalate or take money", () => {
    const actions = SENSITIVE_ACTIONS.map((a) => a.action);
    for (const must of ["identity.reveal", "person.export", "user.role_change", "auth.login", "data.deletion_request"]) {
      expect(actions, `${must} is not recorded`).toContain(must);
    }
  });

  it("sends no name and no exact figure to the speech vendor", () => {
    const spoken = redactForSpeech("Thank you Sarah Okonkwo, AED 2,500/day is noted", ["Sarah Okonkwo"]);
    expect(spoken).not.toMatch(/Sarah|Okonkwo/);
    expect(spoken).not.toMatch(/2,500/);
  });

  it("leaves an ordinary question untouched, so redaction has not broken the conversation", () => {
    expect(redactForSpeech("Where are you based?", ["Sarah"])).toBe("Where are you based?");
  });
});
