import type { AvailabilityRequest, CreateMeetingRequest, ScheduledMeeting, SchedulingProvider, TimeSlot, UpdateMeetingRequest } from "./types";

/**
 * Calendly adapter. Calendly is invitee-driven: we expose a booking link and rely on
 * webhooks (invitee.created / invitee.canceled) to map bookings back to a person.
 */
export class CalendlySchedulingProvider implements SchedulingProvider {
  readonly kind = "CALENDLY" as const;
  readonly displayName = "Calendly";
  readonly requestedScopes = ["default"];

  constructor(private getAccessToken: () => Promise<string | null> = async () => null, private bookingUrl: string | null = null) {}

  isConfigured() {
    return Boolean(process.env.CALENDLY_CLIENT_ID && process.env.CALENDLY_CLIENT_SECRET);
  }

  async connect() {
    if (!this.isConfigured()) return { authorizationUrl: null };
    const params = new URLSearchParams({
      client_id: process.env.CALENDLY_CLIENT_ID as string,
      response_type: "code",
      redirect_uri: `${process.env.AUTH_URL ?? ""}/api/integrations/calendly/callback`,
    });
    return { authorizationUrl: `https://auth.calendly.com/oauth/authorize?${params}` };
  }

  async disconnect() {}

  private async api(path: string, init: RequestInit = {}) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Calendly is not connected");
    const res = await fetch(`https://api.calendly.com${path}`, {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Calendly ${res.status}`);
    return res.json();
  }

  async getAvailability(input: AvailabilityRequest): Promise<TimeSlot[]> {
    const me = (await this.api("/users/me")) as { resource: { uri: string } };
    const params = new URLSearchParams({ user: me.resource.uri, start_time: input.from.toISOString(), end_time: input.to.toISOString() });
    const data = (await this.api(`/user_busy_times?${params}`)) as { collection: { start_time: string; end_time: string }[] };
    // Invert busy times into free slots inside working hours.
    const busy = data.collection.map((b) => ({ start: new Date(b.start_time), end: new Date(b.end_time) }));
    const slots: TimeSlot[] = [];
    const cursor = new Date(input.from);
    cursor.setMinutes(0, 0, 0);
    while (cursor < input.to && slots.length < 40) {
      const end = new Date(cursor.getTime() + input.durationMinutes * 60_000);
      const h = cursor.getHours();
      const clash = busy.some((b) => b.start < end && b.end > cursor);
      if (h >= 9 && h < 17 && !clash) slots.push({ start: new Date(cursor), end });
      cursor.setHours(cursor.getHours() + 1);
    }
    return slots;
  }

  async createMeeting(input: CreateMeetingRequest): Promise<ScheduledMeeting> {
    // Calendly bookings are made by the invitee. We hand back the booking link and record a proposed slot.
    return { externalId: null, url: this.bookingUrl, start: input.start, end: input.end, provider: "CALENDLY" };
  }

  async updateMeeting(_externalId: string, input: UpdateMeetingRequest): Promise<ScheduledMeeting> {
    return { externalId: _externalId, url: this.bookingUrl, start: input.start ?? new Date(), end: input.end ?? new Date(), provider: "CALENDLY" };
  }

  async cancelMeeting(externalId: string) {
    await this.api(`/scheduled_events/${externalId}/cancellation`, { method: "POST", body: JSON.stringify({ reason: "Cancelled from Network Intelligence Platform" }) });
  }
}

/** Verify Calendly webhook signature (HMAC-SHA256 over "t.body"). */
export async function verifyCalendlySignature(rawBody: string, header: string | null, signingKey: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === v1;
}
