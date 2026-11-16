"use server";
import { headers } from "next/headers";
import { getAIProvider, type ProfileDraft, type ExtractedSummary } from "@/lib/ai";
import { requireInternalAction } from "@/server/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { resolveInvite } from "@/server/invites";

const MAX_TEXT = 8000;

export type EnrichInput = { name?: string; linkedinUrl?: string; text?: string };
export type EnrichResult = { ok: true; draft: ProfileDraft } | { ok: false; error: string };

function clean(input: EnrichInput): EnrichInput {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  input = { name: str(input?.name), linkedinUrl: str(input?.linkedinUrl), text: str(input?.text) };
  return {
    name: (input.name ?? "").trim().slice(0, 160) || undefined,
    linkedinUrl: (input.linkedinUrl ?? "").trim().slice(0, 300) || undefined,
    text: (input.text ?? "").trim().slice(0, MAX_TEXT) || undefined,
  };
}

/**
 * Agentic intake: draft a reviewable profile from a name, a LinkedIn URL and/or pasted
 * text. The draft only ever pre-fills a form a human confirms — nothing is written here.
 */
export async function enrichProfileDraft(input: EnrichInput): Promise<EnrichResult> {
  const user = await requireInternalAction();
  const h = await headers();
  const limited = await rateLimit("mutate", `enrich:${user.id}:${clientIp(h)}`);
  if (!limited.success) return { ok: false, error: "That's a lot of drafts in a short time. Give it a moment and try again." };
  const c = clean(input);
  if (!c.name && !c.linkedinUrl && !c.text) return { ok: false, error: "Paste a LinkedIn URL, or a few lines about the person, first." };
  try {
    const provider = getAIProvider();
    const draft = await provider.enrichProfile(c);
    await audit({ tenantId: user.tenantId, actorId: user.id, action: "person.enrich", entityType: "Person", metadata: { provider: provider.name, source: c.linkedinUrl ? "linkedin" : "text", confidence: draft.confidence } });
    return { ok: true, draft };
  } catch (err) {
    console.error("[enrich] failed", err);
    return { ok: false, error: "Couldn't draft a profile just now. You can still fill it in by hand." };
  }
}

export type SelfDraft = { firstName: string; lastName: string; headline: string };

/**
 * Same drafting for the public join form: no account yet, so it is open only to someone holding
 * a valid invitation, throttled per address, capped in size, and it hands back just the three
 * fields the form uses — never the model's free text.
 */
export async function enrichSelfDraft(input: EnrichInput & { inviteToken?: string }): Promise<{ ok: true; draft: SelfDraft } | { ok: false; error: string }> {
  const h = await headers();
  if (!(await rateLimit("join", `self-enrich:${clientIp(h)}`)).success) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  if (!(await resolveInvite(typeof input?.inviteToken === "string" ? input.inviteToken : null)).ok) return { ok: false, error: "Open your invitation link again, then try." };
  const c = clean({ linkedinUrl: typeof input.linkedinUrl === "string" ? input.linkedinUrl : undefined, text: typeof input.text === "string" ? input.text.slice(0, 1500) : undefined });
  if (!c.linkedinUrl && !c.text) return { ok: false, error: "Add your LinkedIn link or a short bio first." };
  try {
    const d = await getAIProvider().enrichProfile(c);
    const short = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n) : "");
    return { ok: true, draft: { firstName: short(d.firstName, 60), lastName: short(d.lastName, 60), headline: short(d.headline, 200) } };
  } catch (err) {
    console.error("[enrich] self failed", err);
    return { ok: false, error: "Couldn't read that just now. You can fill the form in yourself." };
  }
}

export type IntakeResult = { ok: true; summary: ExtractedSummary } | { ok: false; error: string };

/**
 * AI intake: structure a free-flowing intake conversation into a reviewable summary.
 * Reuses structureConversation; the transcript is untrusted input and nothing is written here.
 */
export async function structureIntake(input: { personName?: string; transcript: string }): Promise<IntakeResult> {
  const user = await requireInternalAction();
  const h = await headers();
  const limited = await rateLimit("mutate", `intake:${user.id}:${clientIp(h)}`);
  if (!limited.success) return { ok: false, error: "One moment — that's a lot of summaries in a short time." };
  const transcript = (typeof input?.transcript === "string" ? input.transcript : "").trim().slice(0, 12000);
  if (transcript.length < 20) return { ok: false, error: "Have a little more of a conversation first." };
  try {
    const summary = await getAIProvider().structureConversation({ personName: (typeof input.personName === "string" ? input.personName.slice(0, 120) : "") || "the person", transcript });
    return { ok: true, summary };
  } catch (err) {
    console.error("[intake] structure failed", err);
    return { ok: false, error: "Couldn't summarise the conversation just now. Try again in a moment." };
  }
}
