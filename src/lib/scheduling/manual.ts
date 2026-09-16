import type { AvailabilityRequest, CreateMeetingRequest, ScheduledMeeting, SchedulingProvider, TimeSlot, UpdateMeetingRequest } from "./types";

/** Always available. Records the conversation without touching an external calendar. */
export class ManualSchedulingProvider implements SchedulingProvider {
  readonly kind = "MANUAL" as const;
  readonly displayName = "Manual (call / in person)";
  readonly requestedScopes: string[] = [];
  isConfigured() { return true; }
  async connect() { return { authorizationUrl: null }; }
  async disconnect() {}
  async getAvailability(input: AvailabilityRequest): Promise<TimeSlot[]> {
    // Working-hours slots for the requested window, in whole hours.
    const slots: TimeSlot[] = [];
    const cursor = new Date(input.from);
    cursor.setMinutes(0, 0, 0);
    while (cursor < input.to && slots.length < 40) {
      const h = cursor.getHours();
      const day = cursor.getDay();
      if (day !== 0 && day !== 6 && h >= 9 && h < 17) {
        slots.push({ start: new Date(cursor), end: new Date(cursor.getTime() + input.durationMinutes * 60_000) });
      }
      cursor.setHours(cursor.getHours() + 1);
    }
    return slots;
  }
  async createMeeting(input: CreateMeetingRequest): Promise<ScheduledMeeting> {
    return { externalId: null, url: null, start: input.start, end: input.end, provider: "MANUAL" };
  }
  async updateMeeting(_externalId: string, input: UpdateMeetingRequest): Promise<ScheduledMeeting> {
    return { externalId: null, url: null, start: input.start ?? new Date(), end: input.end ?? new Date(), provider: "MANUAL" };
  }
  async cancelMeeting() {}
}
