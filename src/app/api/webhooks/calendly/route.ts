import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCalendlySignature } from "@/lib/scheduling/calendly";

/** Calendly webhooks: invitee.created / invitee.canceled → map invitee email to a person and record the meeting. */
export async function POST(req: Request) {
  const raw = await req.text();
  const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!key) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const ok = await verifyCalendlySignature(raw, req.headers.get("calendly-webhook-signature"), key);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  const body = JSON.parse(raw) as { event: string; payload: { email?: string; scheduled_event?: { uri?: string; start_time?: string; end_time?: string; location?: { join_url?: string } } } };
  const email = body.payload.email?.toLowerCase();
  const ev = body.payload.scheduled_event;
  if (!email || !ev?.uri) return NextResponse.json({ ok: true, ignored: true });
  const externalId = ev.uri.split("/").pop() ?? ev.uri;

  if (body.event === "invitee.canceled") {
    await prisma.scheduledConversation.updateMany({ where: { provider: "CALENDLY", externalEventId: externalId }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true });
  }

  const person = await prisma.person.findFirst({ where: { email }, select: { id: true, tenantId: true } });
  if (!person) return NextResponse.json({ ok: true, unmatched: true });
  const owner = await prisma.schedulingConnection.findFirst({ where: { provider: "CALENDLY", revokedAt: null, user: { tenantId: person.tenantId } }, select: { userId: true } });
  if (!owner) return NextResponse.json({ ok: true, unmatched: true });
  await prisma.scheduledConversation.upsert({
    where: { id: `calendly-${externalId}` },
    create: { id: `calendly-${externalId}`, tenantId: person.tenantId, personId: person.id, ownerId: owner.userId, provider: "CALENDLY", externalEventId: externalId, eventUrl: ev.location?.join_url ?? null, startAt: new Date(ev.start_time ?? Date.now()), endAt: new Date(ev.end_time ?? Date.now()), status: "SCHEDULED" },
    update: { startAt: new Date(ev.start_time ?? Date.now()), endAt: new Date(ev.end_time ?? Date.now()), status: "SCHEDULED", eventUrl: ev.location?.join_url ?? null },
  });
  return NextResponse.json({ ok: true });
}
