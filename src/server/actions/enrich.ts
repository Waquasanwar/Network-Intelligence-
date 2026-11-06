"use server";
import { headers } from "next/headers";
import { getAIProvider, type ProfileDraft, type ExtractedSummary } from "@/lib/ai";
import { requireInternalAction } from "@/server/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

const MAX_TEXT = 8000;

export type EnrichInput = { name?: string; linkedinUrl?: string; text?: string };
export type EnrichResult = { ok: true; draft: ProfileDraft } | { ok: false; error: string };

function clean(input: EnrichInput): EnrichInput {
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

/**
 * Same drafting for the public self-registration flow: no auth, rate-limited by IP, and
 * no audit actor. Used to pre-fill the person's own join form from their LinkedIn or bio.
 */
export async function enrichSelfDraft(input: EnrichInput): Promise<EnrichResult> {
  const h = await headers();
  const limited = await rateLimit("signin", `self-enrich:${clientIp(h)}`);
  if (!limited.success) return { ok: false, error: "Too many attempts. Please wait a minute and try again." };
  const c = clean(input);
  if (!c.name && !c.linkedinUrl && !c.text) return { ok: false, error: "Add your LinkedIn link or a short bio first." };
  try {
    const draft = await getAIProvider().enrichProfile(c);
    return { ok: true, draft };
  } catch (err) {
    console.error("[enrich] self failed", err);
    return { ok: false, error: "Couldn't read that just now — you can fill the form in yourself." };
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
  const transcript = (input.transcript ?? "").trim().slice(0, 12000);
  if (transcript.length < 20) return { ok: false, error: "Have a little more of a conversation first." };
  try {
    const summary = await getAIProvider().structureConversation({ personName: input.personName?.slice(0, 120) || "the person", transcript });
    return { ok: true, summary };
  } catch (err) {
    console.error("[intake] structure failed", err);
    return { ok: false, error: "Couldn't summarise the conversation just now. Try again in a moment." };
  }
}
