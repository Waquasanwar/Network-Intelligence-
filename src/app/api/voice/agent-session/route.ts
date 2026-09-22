/**
 * A short-lived signed URL for a two-way conversational agent.
 *
 * The browser needs to open a WebSocket to the voice vendor directly — audio cannot sensibly be
 * proxied through us — but it must never hold the API key. ElevenLabs signs a per-session URL for
 * exactly this: we ask for one with the key, hand back only the URL, and it expires on its own.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { DEFAULT_VOICE, type VoiceSettings } from "@/lib/voice-config";

export async function GET() {
  const user = await requireUser();
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "No natural voice configured on this platform.", fallback: "device" }, { status: 503 });

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { voiceSettings: true } });
  const v: VoiceSettings = { ...DEFAULT_VOICE, ...((tenant?.voiceSettings as Partial<VoiceSettings> | null) ?? {}) };
  if (!v.agentId) return NextResponse.json({ error: "No conversational agent configured. Read-aloud will be used instead.", fallback: "speak" }, { status: 503 });

  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(v.agentId)}`, {
    headers: { "xi-api-key": key },
  }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: `Could not start the voice session (${res?.status ?? "no response"}).`, fallback: "speak" }, { status: 502 });

  const data = (await res.json().catch(() => null)) as { signed_url?: string } | null;
  if (!data?.signed_url) return NextResponse.json({ error: "The voice session did not return a URL.", fallback: "speak" }, { status: 502 });
  return NextResponse.json({ signedUrl: data.signed_url, expiresInSeconds: 60 }, { headers: { "cache-control": "no-store" } });
}
