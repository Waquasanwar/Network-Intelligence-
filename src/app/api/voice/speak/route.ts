/**
 * Speech for the interviewer's lines.
 *
 * The browser posts a line of text; this returns audio. The ElevenLabs key stays here, in the
 * server environment, and is never sent to the client. Nothing is written to disk or logged: the
 * text is a question we wrote, and the person's own answers never come through this route.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { DEFAULT_VOICE, redactForSpeech, type VoiceSettings } from "@/lib/voice-config";

const MAX_CHARS = 600;
/** Cheap per-user throttle: a live call speaks a line every few seconds, not every few milliseconds. */
const recent = new Map<string, number[]>();
const RATE = { windowMs: 60_000, max: 60 };

function allowed(userId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < RATE.windowMs);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length <= RATE.max;
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!allowed(user.id)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "No natural voice configured on this platform. Falling back to the device voice.", fallback: "device" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { text?: string; names?: string[] } | null;
  const raw = (body?.text ?? "").trim();
  if (!raw) return NextResponse.json({ error: "Nothing to say" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { voiceSettings: true } });
  const v: VoiceSettings = { ...DEFAULT_VOICE, ...((tenant?.voiceSettings as Partial<VoiceSettings> | null) ?? {}) };
  if (!v.voiceId) return NextResponse.json({ error: "No voice chosen. Add a voice id in Settings.", fallback: "device" }, { status: 503 });

  const text = (v.redactBeforeSpeaking ? redactForSpeech(raw, body?.names ?? []) : raw).slice(0, MAX_CHARS);

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v.voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: v.modelId, voice_settings: { stability: v.stability, similarity_boost: v.similarity, style: v.style, speed: v.speed, use_speaker_boost: true } }),
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    // Never pass a vendor's error body through: it can carry account detail. Say what to do instead.
    return NextResponse.json({ error: `The natural voice did not answer (${upstream?.status ?? "no response"}). Using the device voice.`, fallback: "device" }, { status: 502 });
  }

  return new NextResponse(upstream.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}
