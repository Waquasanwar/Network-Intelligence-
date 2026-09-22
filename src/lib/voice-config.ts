/**
 * Which voice the interviewer speaks in, and where the speech is made.
 *
 * Two providers:
 *  - "device": the browser's own speech synthesis. Free, offline, robotic. Always the fallback.
 *  - "elevenlabs": natural speech from ElevenLabs. The API key lives in the server environment
 *    (ELEVENLABS_API_KEY) and is never sent to the browser: the page posts text to our own
 *    /api/voice/speak and gets audio back, or asks /api/voice/agent-session for a short-lived
 *    signed URL when the full conversational agent is used.
 *
 * Confidentiality: what someone says in a screening is commercially sensitive. Sending text to a
 * third party for speech is a decision the tenant makes explicitly — hence `provider`, and hence
 * `redactBeforeSpeaking`, which keeps names and numbers out of anything we ask a vendor to read
 * back. Recognition of what the person says stays on their device either way; we keep the text.
 */

export type VoiceProvider = "device" | "elevenlabs";

export type VoiceSettings = {
  provider: VoiceProvider;
  /** A voice id from the tenant's own ElevenLabs voice library. No default: voices are theirs, not ours. */
  voiceId: string;
  modelId: string;
  stability: number;
  similarity: number;
  /** 0 keeps it level; higher is more expressive and less predictable. */
  style: number;
  speed: number;
  /** Optional ElevenLabs Conversational AI agent, for a full two-way call rather than read-aloud. */
  agentId: string | null;
  /** Keep names, employers and exact numbers out of text sent to the speech vendor. */
  redactBeforeSpeaking: boolean;
};

export const DEFAULT_VOICE: VoiceSettings = {
  provider: "device",
  voiceId: "",
  modelId: "eleven_turbo_v2_5",
  stability: 0.45,
  similarity: 0.8,
  style: 0.15,
  speed: 1,
  agentId: null,
  redactBeforeSpeaking: true,
};

/** Models worth offering: low latency matters more than anything else in a live call. */
export const VOICE_MODELS: [string, string][] = [
  ["eleven_flash_v2_5", "Flash v2.5 — fastest, good for live turns"],
  ["eleven_turbo_v2_5", "Turbo v2.5 — fast, warmer"],
  ["eleven_multilingual_v2", "Multilingual v2 — richest, a little slower"],
];

export const PROVIDER_LABELS: Record<VoiceProvider, string> = {
  device: "This device — free, private, robotic",
  elevenlabs: "ElevenLabs — natural, billed to your account",
};

/**
 * Strip the things that should not be handed to a speech vendor: a person's name, an employer,
 * and exact money. The interviewer's lines are written to survive this — it changes
 * "Thank you Sarah" into "Thank you", not the meaning of the question.
 */
export function redactForSpeech(text: string, names: string[] = []): string {
  let out = text;
  for (const n of names) {
    for (const part of n.split(/\s+/).filter((p) => p.length > 2)) {
      out = out.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "");
    }
  }
  return out
    .replace(/[£$€]\s?\d[\d,.]*\s?(k|m|bn)?/gi, "the figure you gave")
    .replace(/\b(AED|SAR|USD|GBP|EUR)\s?\d[\d,.]*\s?(k|m)?/gi, "the figure you gave")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/** True when the platform can actually speak in the natural voice. */
export function elevenReady(v: VoiceSettings, keyConfigured: boolean): boolean {
  return v.provider === "elevenlabs" && keyConfigured && (!!v.voiceId || !!v.agentId);
}
