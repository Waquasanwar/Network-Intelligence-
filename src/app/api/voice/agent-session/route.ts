/**
 * A short-lived signed URL for a two-way conversational agent.
 *
 * The browser needs to open a WebSocket to the voice vendor directly — audio cannot sensibly be
 * proxied through us — but it must never hold the API key. ElevenLabs signs a per-session URL for
 * exactly this: we ask for one with the key, hand back only the URL, and it expires on its own.
 */
import { NextResponse } from "next/server";
import { getUser } from "@/server/session";
import { rateLimit } from "@/lib/rate-limit";
import { voiceAccess } from "@/lib/voice-access";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  // A handful of sessions per screening is plenty; each one is billed.
  if (!(await rateLimit("signin", `voice-session:${user.id}`)).success) return NextResponse.json({ error: "Too many voice sessions. Try again in a few minutes.", fallback: "speak" }, { status: 429 });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "No natural voice configured on this platform.", fallback: "device" }, { status: 503 });

  const access = await voiceAccess(user);
  if (!access.ok) return NextResponse.json({ error: access.error, fallback: access.fallback }, { status: access.status });
  const v = access.settings;
  if (!v.agentId || !/^[A-Za-z0-9_-]{1,64}$/.test(v.agentId)) return NextResponse.json({ error: "No conversational agent configured. Read-aloud will be used instead.", fallback: "speak" }, { status: 503 });

  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(v.agentId)}`, {
    headers: { "xi-api-key": key },
  }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: `Could not start the voice session (${res?.status ?? "no response"}).`, fallback: "speak" }, { status: 502 });

  const data = (await res.json().catch(() => null)) as { signed_url?: string } | null;
  if (!data?.signed_url) return NextResponse.json({ error: "The voice session did not return a URL.", fallback: "speak" }, { status: 502 });
  return NextResponse.json({ signedUrl: data.signed_url, expiresInSeconds: 60 }, { headers: { "cache-control": "no-store" } });
}
