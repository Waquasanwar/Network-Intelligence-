import type { AvailabilityRequest, CreateMeetingRequest, ScheduledMeeting, SchedulingProvider, TimeSlot, UpdateMeetingRequest } from "./types";

/**
 * Microsoft Graph adapter (Outlook / Teams). Delegated, least-privilege permissions.
 * Token exchange and storage are handled by the OAuth callback route; this adapter only
 * knows how to call Graph with an access token supplied by the credential store.
 */
export class MicrosoftGraphSchedulingProvider implements SchedulingProvider {
  readonly kind = "MICROSOFT_GRAPH" as const;
  readonly displayName = "Microsoft Outlook / Teams";
  readonly requestedScopes = ["offline_access", "User.Read", "Calendars.ReadWrite", "OnlineMeetings.ReadWrite"];

  constructor(private getAccessToken: () => Promise<string | null> = async () => null) {}

  isConfigured() {
    return Boolean(process.env.MICROSOFT_GRAPH_CLIENT_ID && process.env.MICROSOFT_GRAPH_CLIENT_SECRET);
  }

  async connect() {
    if (!this.isConfigured()) return { authorizationUrl: null };
    const tenant = process.env.MICROSOFT_GRAPH_TENANT_ID || "common";
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_GRAPH_CLIENT_ID as string,
      response_type: "code",
      redirect_uri: `${process.env.AUTH_URL ?? ""}/api/integrations/microsoft/callback`,
      response_mode: "query",
      scope: this.requestedScopes.join(" "),
    });
    return { authorizationUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}` };
  }

  async disconnect() {}

  private async graph(path: string, init: RequestInit = {}) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Microsoft Graph is not connected");
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Graph ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  async getAvailability(input: AvailabilityRequest): Promise<TimeSlot[]> {
    const data = (await this.graph("/me/calendar/getSchedule", {
      method: "POST",
      body: JSON.stringify({
        schedules: ["me"],
        startTime: { dateTime: input.from.toISOString(), timeZone: input.timezone },
        endTime: { dateTime: input.to.toISOString(), timeZone: input.timezone },
        availabilityViewInterval: input.durationMinutes,
      }),
    })) as { value: { availabilityView: string }[] };
    const view = data.value[0]?.availabilityView ?? "";
    const slots: TimeSlot[] = [];
    for (let i = 0; i < view.length; i++) {
      if (view[i] === "0") {
        const start = new Date(input.from.getTime() + i * input.durationMinutes * 60_000);
        slots.push({ start, end: new Date(start.getTime() + input.durationMinutes * 60_000) });
      }
    }
    return slots;
  }

  async createMeeting(input: CreateMeetingRequest): Promise<ScheduledMeeting> {
    const ev = (await this.graph("/me/events", {
      method: "POST",
      body: JSON.stringify({
        subject: input.title,
        body: { contentType: "text", content: input.description ?? "" },
        start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
        end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
        attendees: input.attendees.filter((a) => a.email).map((a) => ({ emailAddress: { address: a.email, name: a.name }, type: "required" })),
        isOnlineMeeting: input.onlineMeeting ?? true,
        onlineMeetingProvider: "teamsForBusiness",
      }),
    })) as { id: string; webLink?: string; onlineMeeting?: { joinUrl?: string } };
    return { externalId: ev.id, url: ev.onlineMeeting?.joinUrl ?? ev.webLink ?? null, start: input.start, end: input.end, provider: "MICROSOFT_GRAPH" };
  }

  async updateMeeting(externalId: string, input: UpdateMeetingRequest): Promise<ScheduledMeeting> {
    const body: Record<string, unknown> = {};
    if (input.title) body.subject = input.title;
    if (input.start) body.start = { dateTime: input.start.toISOString(), timeZone: input.timezone ?? "UTC" };
    if (input.end) body.end = { dateTime: input.end.toISOString(), timeZone: input.timezone ?? "UTC" };
    const ev = (await this.graph(`/me/events/${externalId}`, { method: "PATCH", body: JSON.stringify(body) })) as { id: string; webLink?: string };
    return { externalId: ev.id, url: ev.webLink ?? null, start: input.start ?? new Date(), end: input.end ?? new Date(), provider: "MICROSOFT_GRAPH" };
  }

  async cancelMeeting(externalId: string) {
    await this.graph(`/me/events/${externalId}`, { method: "DELETE" });
  }
}
