import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyCalendlySignature } from "@/lib/scheduling/calendly";

const payloadSchema = z.object({
  event: z.string().max(60),
  created_by: z.string().max(300).optional(),
  payload: z.object({
    email: z.string().email().max(200).optional(),
    scheduled_event: z.object({
      uri: z.string().max(300).optional(),
      start_time: z.string().max(40).optional(),
      end_time: z.string().max(40).optional(),
      location: z.object({ join_url: z.string().max(500).optional() }).partial().optional().nullable(),
      event_memberships: z.array(z.object({ user: z.string().max(300).optional() })).max(20).optional(),
    }).optional(),
  }),
});

/**
 * Calendly webhooks: invitee.created / invitee.canceled → map the invitee to a person and record
 * the meeting. A delivery is only ever applied inside the network whose connected Calendly account
 * it came from: the invitee's email is looked up in that tenant and nowhere else.
 */
export async function POST(req: Request) {
  const raw = (await req.text()).slice(0, 200_000);
  const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!key) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const ok = await verifyCalendlySignature(raw, req.headers.get("calendly-webhook-signature"), key);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: true, ignored: true });
  const body = parsed.data;
  const email = body.payload.email?.toLowerCase();
  const ev = body.payload.scheduled_event;
  if (!email || !ev?.uri) return NextResponse.json({ ok: true, ignored: true });
  const externalId = (ev.uri.split("/").pop() ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  if (!externalId) return NextResponse.json({ ok: true, ignored: true });

  // Which of our connected Calendly accounts does this booking belong to?
  const hosts = [body.created_by, ...(ev.event_memberships ?? []).map((m) => m.user)].filter((u): u is string => !!u);
  const conn = hosts.length ? await prisma.schedulingConnection.findFirst({ where: { provider: "CALENDLY", revokedAt: null, externalAccountId: { in: hosts } }, select: { userId: true, user: { select: { tenantId: true } } } }) : null;
  if (!conn) return NextResponse.json({ ok: true, unmatched: true });
  const tenantId = conn.user.tenantId;

  if (body.event === "invitee.canceled") {
    await prisma.scheduledConversation.updateMany({ where: { tenantId, provider: "CALENDLY", externalEventId: externalId }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true });
  }
  if (body.event !== "invitee.created") return NextResponse.json({ ok: true, ignored: true });

  const person = await prisma.person.findFirst({ where: { tenantId, email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (!person) return NextResponse.json({ ok: true, unmatched: true });
  const start = new Date(ev.start_time ?? ""), end = new Date(ev.end_time ?? "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return NextResponse.json({ ok: true, ignored: true });
  // Only ever store an https link: this value is rendered as a clickable "Join" link.
  const join = ev.location?.join_url && /^https:\/\//i.test(ev.location.join_url) ? ev.location.join_url : null;
  const id = `calendly-${externalId}`;
  const existing = await prisma.scheduledConversation.findUnique({ where: { id }, select: { tenantId: true } });
  if (existing && existing.tenantId !== tenantId) return NextResponse.json({ ok: true, ignored: true });
  await prisma.scheduledConversation.upsert({
    where: { id },
    create: { id, tenantId, personId: person.id, ownerId: conn.userId, provider: "CALENDLY", externalEventId: externalId, eventUrl: join, startAt: start, endAt: end, status: "SCHEDULED" },
    update: { startAt: start, endAt: end, status: "SCHEDULED", eventUrl: join },
  });
  return NextResponse.json({ ok: true });
}
