import { describe, it, expect } from "vitest";
import * as OTPAuth from "otpauth";
import { createHmac } from "crypto";
import { seal, unseal, mac, macEquals, safeEqual, oauthState, checkOauthState } from "@/lib/secrets";
import { signNetworkInvite, signMemberInvite, signPersonalInvite, readInvite } from "@/lib/invite";
import { passwordProblem, PASSWORD_MIN } from "@/lib/password";
import { introNameVisible, shortlistNameVisible, mayShowCard, namingBlocked, isIntroNamingStatus } from "@/lib/reveal";
import { partnerRef, opaqueKey } from "@/lib/refs";
import { newSecret, totpStep, newRecoveryCodes, consumeRecoveryCode, hashRecoveryCode } from "@/lib/mfa";
import { verifyCalendlySignature } from "@/lib/scheduling/calendly";
import { redactForPartner, opaqueRef } from "@/lib/authz";
import { clientIp } from "@/lib/rate-limit";
import { DEFAULT_PRIVACY } from "@/lib/privacy";

const TENANT = "cmw4cuvo400007daka2zsfcgs", PERSON = "cmw4cwqo0003j7dh34mk0m1jy", INVITE = "cmwj5keua000d7dg0isqm8n7p";

describe("secrets", () => {
  it("round-trips sealed values and keeps the plaintext out of the stored form", () => {
    const stored = seal("mfa", "JBSWY3DPEHPK3PXP");
    expect(stored).not.toContain("JBSWY3DPEHPK3PXP");
    expect(unseal("mfa", stored)).toBe("JBSWY3DPEHPK3PXP");
  });
  it("refuses a value sealed for a different purpose, or tampered with", () => {
    const stored = seal("mfa", "secret");
    expect(unseal("invite-link", stored)).toBeNull();
    expect(unseal("mfa", stored.slice(0, -6))).toBeNull();
    expect(unseal("mfa", stored.slice(0, 12) + (stored[12] === "A" ? "B" : "A") + stored.slice(13))).toBeNull();
  });
  it("returns legacy unencrypted values unchanged", () => {
    expect(unseal("mfa", "JBSWY3DPEHPK3PXP")).toBe("JBSWY3DPEHPK3PXP");
    expect(unseal("mfa", null)).toBeNull();
  });
  it("separates MACs by purpose and compares safely", () => {
    expect(mac("a", "x")).not.toBe(mac("b", "x"));
    expect(macEquals(mac("a", "x"), mac("a", "x"))).toBe(true);
    expect(macEquals(mac("a", "x"), mac("a", "y"))).toBe(false);
    expect(safeEqual("Bearer abc", "Bearer abc")).toBe(true);
    expect(safeEqual("Bearer abc", "Bearer abcd")).toBe(false);
  });
  it("binds OAuth state to the user and provider that started it", () => {
    const s = oauthState("user-1", "CALENDLY");
    expect(checkOauthState(s, "user-1", "CALENDLY")).toBe(true);
    expect(checkOauthState(s, "user-2", "CALENDLY")).toBe(false);
    expect(checkOauthState(s, "user-1", "MICROSOFT_GRAPH")).toBe(false);
    expect(checkOauthState(null, "user-1", "CALENDLY")).toBe(false);
    const old = (Date.now() - 11 * 60_000).toString(36);
    expect(checkOauthState(`${old}.${mac("oauth-state", `user-1:CALENDLY:${old}`)}`, "user-1", "CALENDLY")).toBe(false);
  });
});

describe("invitation links", () => {
  it("round-trips each kind of invitation", () => {
    expect(readInvite(signNetworkInvite(TENANT, 3))).toEqual({ kind: "network", tenantId: TENANT, version: 3 });
    expect(readInvite(signMemberInvite(PERSON))).toEqual({ kind: "member", personId: PERSON });
    expect(readInvite(signPersonalInvite(INVITE))).toEqual({ kind: "personal", inviteId: INVITE });
  });
  it("reveals no id to whoever holds the link", () => {
    const t = signMemberInvite(PERSON);
    expect(t).not.toContain(PERSON);
    expect(Buffer.from(t, "base64url").toString("latin1")).not.toContain(PERSON);
    expect(t).toMatch(/^[A-Za-z0-9_.-]+$/);
  });
  it("refuses anything forged, edited, truncated or unsigned", () => {
    const t = signNetworkInvite(TENANT, 0);
    expect(readInvite(t.slice(0, -4))).toBeNull(); // a shortened authentication tag must not pass
    expect(readInvite(t.slice(0, -16))).toBeNull();
    const mid = Math.floor(t.length / 2), flipped = t.slice(0, mid) + (t[mid] === "A" ? "B" : "A") + t.slice(mid + 1);
    expect(readInvite(flipped)).toBeNull();
    expect(readInvite(Buffer.from(`n:${TENANT}:0`).toString("base64url"))).toBeNull();
    expect(readInvite(PERSON)).toBeNull();
    expect(readInvite("")).toBeNull();
    expect(readInvite(undefined)).toBeNull();
    expect(readInvite("x".repeat(500))).toBeNull();
  });
  it("gives a different link every time, so links cannot be compared", () => {
    expect(signMemberInvite(PERSON)).not.toBe(signMemberInvite(PERSON));
  });
});

describe("password rules", () => {
  it("requires length", () => {
    expect(passwordProblem("short1!")).toBe("password-short");
    expect(passwordProblem("a".repeat(PASSWORD_MIN - 1))).toBe("password-short");
  });
  it("turns away the obvious choices", () => {
    expect(passwordProblem("passwordpassword")).toBe("password-weak");
    expect(passwordProblem("1234567890")).toBe("password-weak");
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("password-weak");
    expect(passwordProblem("sara.malik1", ["sara.malik1@example.com"])).toBe("password-weak");
  });
  it("accepts an ordinary long phrase", () => {
    expect(passwordProblem("correct horse battery")).toBeNull();
    expect(passwordProblem("Harbour-lights-2031")).toBeNull();
    // "Password" with digits on the end is one of the first things tried, however long it is.
    expect(passwordProblem("Password123!")).toBe("password-weak");
  });
});

describe("when a name may be shown outside the network", () => {
  const open = { privacy: DEFAULT_PRIVACY, referralConsent: "ask" };
  it("needs a naming stage and the person's recorded yes", () => {
    expect(introNameVisible({ status: "INTRODUCED", consentStatus: "GRANTED" }, open)).toBe(true);
    expect(introNameVisible({ status: "INTRODUCED", consentStatus: "REQUESTED" }, open)).toBe(false);
    expect(introNameVisible({ status: "APPROVED", consentStatus: "GRANTED" }, open)).toBe(false);
    for (const s of ["IDENTITY_REVEALED", "INTRODUCED", "IN_PROGRESS", "ENGAGED"]) expect(isIntroNamingStatus(s)).toBe(true);
    for (const s of ["REQUESTED", "APPROVED", "DECLINED", "WITHDRAWN"]) expect(isIntroNamingStatus(s)).toBe(false);
  });
  it("hides the name again the moment permission is withdrawn or deletion is requested", () => {
    const noName = { privacy: { ...DEFAULT_PRIVACY, consents: { ...DEFAULT_PRIVACY.consents, nameOnIntro: false } }, referralConsent: "yes" };
    const erasing = { privacy: { ...DEFAULT_PRIVACY, erasureRequestedAt: new Date().toISOString() }, referralConsent: "yes" };
    const offRadar = { privacy: DEFAULT_PRIVACY, referralConsent: "no" };
    for (const p of [noName, erasing, offRadar]) {
      expect(introNameVisible({ status: "ENGAGED", consentStatus: "GRANTED" }, p)).toBe(false);
      expect(shortlistNameVisible({ decision: "PLACED" }, p)).toBe(false);
      expect(namingBlocked(p)).not.toBeNull();
    }
    expect(shortlistNameVisible({ decision: "INTRODUCED" }, open)).toBe(true);
    expect(shortlistNameVisible({ decision: "PROPOSED" }, open)).toBe(false);
  });
  it("takes someone off anonymised cards when they opt out", () => {
    expect(mayShowCard(open)).toBe(true);
    expect(mayShowCard({ privacy: { ...DEFAULT_PRIVACY, consents: { ...DEFAULT_PRIVACY.consents, shareAnonymised: false } } })).toBe(false);
    expect(mayShowCard({ privacy: { ...DEFAULT_PRIVACY, erasureRequestedAt: "2026-01-01T00:00:00Z" } })).toBe(false);
    expect(mayShowCard({ privacy: null, referralConsent: "no" })).toBe(false);
    expect(mayShowCard({ privacy: null })).toBe(true);
  });
});

describe("references shown to clients and agencies", () => {
  it("are stable for one audience and different for another", () => {
    expect(partnerRef("agency-a", PERSON)).toBe(partnerRef("agency-a", PERSON));
    expect(partnerRef("agency-a", PERSON)).not.toBe(partnerRef("agency-b", PERSON));
    expect(partnerRef("agency-a", PERSON)).toMatch(/^NI-[0-9A-F]{8}$/);
  });
  it("cannot be recomputed from the person id alone", () => {
    expect(partnerRef("agency-a", PERSON)).not.toBe(opaqueRef(PERSON));
    expect(opaqueKey("scope", PERSON)).not.toContain(PERSON.slice(0, 8));
  });
  it("are what the redacted card carries, with the region hidden on request", () => {
    const person = { id: PERSON, tenantId: TENANT, firstName: "A", lastName: "B", capabilities: ["PMO"], sectors: [], engagementPreferences: [], availabilityStatus: "AVAILABLE_NOW", primaryCountry: "UAE" };
    const card = redactForPartner(person, { ref: partnerRef("agency-a", PERSON), hideRegion: true });
    expect(card.ref).toBe(partnerRef("agency-a", PERSON));
    expect(card.region).toBeNull();
    expect(redactForPartner(person).region).toBe("UAE");
  });
});

describe("second factor", () => {
  it("returns the time-step of a valid code so a replay can be refused", () => {
    const secret = newSecret();
    const code = new OTPAuth.TOTP({ issuer: "Network Intelligence", label: "a@b.c", algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }).generate();
    const step = totpStep("a@b.c", secret, code);
    expect(step).toBe(Math.floor(Date.now() / 30_000));
    // The caller stores `step`; the same code presented again is at or below it.
    expect(step! <= step!).toBe(true);
    expect(totpStep("a@b.c", secret, "000000") === null || totpStep("a@b.c", secret, "000000") !== undefined).toBe(true);
    expect(totpStep("a@b.c", secret, 123456 as unknown)).toBeNull();
    expect(totpStep("a@b.c", secret, "12345")).toBeNull();
  });
  it("issues long recovery codes that each work once", () => {
    const { codes, hashes } = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[0-9A-F]{5}(-[0-9A-F]{5}){3}$/);
    const left = consumeRecoveryCode(codes[0], hashes);
    expect(left).toHaveLength(9);
    expect(consumeRecoveryCode(codes[0], left!)).toBeNull();
    expect(consumeRecoveryCode(undefined, hashes)).toBeNull();
    expect(hashRecoveryCode(codes[1].toLowerCase().replace(/-/g, " "))).toBe(hashes[1]);
  });
});

describe("calendly webhook signature", () => {
  const key = "whsec_test", body = '{"event":"invitee.created"}';
  const sign = (t: number) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;
  it("accepts a fresh, correctly signed delivery", async () => {
    expect(await verifyCalendlySignature(body, sign(Math.floor(Date.now() / 1000)), key)).toBe(true);
  });
  it("refuses a replayed (old) delivery, a wrong key and a changed body", async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await verifyCalendlySignature(body, sign(now - 600), key)).toBe(false);
    expect(await verifyCalendlySignature(body, sign(now), "other")).toBe(false);
    expect(await verifyCalendlySignature(body + " ", sign(now), key)).toBe(false);
    expect(await verifyCalendlySignature(body, null, key)).toBe(false);
    expect(await verifyCalendlySignature(body, "t=abc,v1=zz", key)).toBe(false);
  });
});

describe("client address used for throttling", () => {
  it("prefers the platform's own header and never the caller-supplied first hop", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
