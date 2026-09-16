/** Scheduling provider abstraction (spec §11). */

export type TimeSlot = { start: Date; end: Date };

export type AvailabilityRequest = { from: Date; to: Date; durationMinutes: number; timezone: string };

export type CreateMeetingRequest = {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  timezone: string;
  attendees: { name: string; email?: string | null }[];
  onlineMeeting?: boolean;
};

export type UpdateMeetingRequest = Partial<Pick<CreateMeetingRequest, "title" | "description" | "start" | "end" | "timezone">>;

export type ScheduledMeeting = {
  externalId: string | null;
  url: string | null;
  start: Date;
  end: Date;
  provider: "MICROSOFT_GRAPH" | "CALENDLY" | "MANUAL";
};

export interface SchedulingProvider {
  readonly kind: ScheduledMeeting["provider"];
  readonly displayName: string;
  /** Least-privilege scopes this adapter requests. Shown to the user before connecting. */
  readonly requestedScopes: string[];
  isConfigured(): boolean;
  connect(userId: string): Promise<{ authorizationUrl: string | null }>;
  disconnect(userId: string): Promise<void>;
  getAvailability(input: AvailabilityRequest): Promise<TimeSlot[]>;
  createMeeting(input: CreateMeetingRequest): Promise<ScheduledMeeting>;
  updateMeeting(externalId: string, input: UpdateMeetingRequest): Promise<ScheduledMeeting>;
  cancelMeeting(externalId: string): Promise<void>;
}
