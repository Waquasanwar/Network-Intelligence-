/**
 * Speech for the interviewer's lines.
 *
 * The browser posts a line of text; this returns audio. The ElevenLabs key stays here, in the
 * server environment, and is never sent to the client. Nothing is written to disk or logged: the
 * text is a question we wrote, and the person's own answers never come through this route.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/server/session";
import { rateLimit } from "@/lib/rate-limit";
import { voiceAccess } from "@/lib/voice-access";
import { redactForSpeech } from "@/lib/voice-config";

const MAX_CHARS = 600;
const bodySchema = z.object({ text: z.string().trim().min(1).max(2000), names: z.array(z.string().max(80)).max(5).optional() });

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  // Shared limiter (works across serverless instances): a screening speaks a line every few seconds.
  if (!(await rateLimit("voice", `speak:${user.id}`)).success) return NextResponse.json({ error: "Too many requests", fallback: "device" }, { status: 429 });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "No natural voice configured on this platform. Falling back to the device voice.", fallback: "device" }, { status: 503 });

  const access = await voiceAccess(user);
  if (!access.ok) return NextResponse.json({ error: access.error, fallback: access.fallback }, { status: access.status });
  const v = access.settings;
  if (!v.voiceId || !/^[A-Za-z0-9_-]{1,64}$/.test(v.voiceId)) return NextResponse.json({ error: "No voice chosen. Add a voice id in Settings.", fallback: "device" }, { status: 503 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to say" }, { status: 400 });
  const text = (v.redactBeforeSpeaking ? redactForSpeech(parsed.data.text, parsed.data.names ?? []) : parsed.data.text).slice(0, MAX_CHARS);

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
