import { z } from "zod";

/**
 * AI provider abstraction (spec §12, "AI security").
 * Transcripts are untrusted input. Providers return *structured suggestions*; nothing
 * becomes authoritative until a human approves it (Conversation.approvedSummary).
 */

export const ExtractedSummarySchema = z.object({
  headline: z.string().max(200).default(""),
  capabilities: z.array(z.string().max(80)).max(30).default([]),
  sectors: z.array(z.string().max(80)).max(20).default([]),
  engagementPreferences: z
    .array(z.enum(["PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"]))
    .max(6)
    .default([]),
  locationPreferences: z.array(z.string().max(80)).max(10).default([]),
  currentStatus: z.string().max(200).default(""),
  suggestedAvailabilityStatus: z
    .enum([
      "AVAILABLE_NOW",
      "OPEN_TO_CONVERSATIONS",
      "QUIETLY_EXPLORING",
      "RIGHT_OPPORTUNITY_ONLY",
      "FINISHING_ENGAGEMENT_SOON",
      "FRACTIONAL_AVAILABILITY",
      "SOW_ONLY",
      "PERMANENT_ONLY",
      "CONTRACT_ONLY",
      "HAPPY_WHERE_I_AM",
      "NOT_LOOKING_KEEP_IN_TOUCH",
      "UNAVAILABLE_UNTIL",
      "TAKING_A_BREAK",
      "NEEDS_REFRESH",
    ])
    .optional(),
  ratesOrSalary: z.string().max(200).default(""),
  workingCharacteristics: z.array(z.string().max(160)).max(12).default([]),
  constraints: z.array(z.string().max(160)).max(12).default([]),
  strengths: z.array(z.string().max(160)).max(12).default([]),
  avoid: z.array(z.string().max(160)).max(12).default([]),
  followUpDate: z.string().max(40).optional(),
  unresolvedQuestions: z.array(z.string().max(200)).max(12).default([]),
  summary: z.string().max(2000).default(""),
});

export type ExtractedSummary = z.infer<typeof ExtractedSummarySchema>;

export interface AIProvider {
  readonly name: string;
  /** Structure a conversation transcript or notes into a reviewable summary. */
  structureConversation(input: { personName: string; notes?: string | null; transcript?: string | null }): Promise<ExtractedSummary>;
  /** Explain, in plain language, why someone may fit — never whether they are "good". */
  explainFit(input: { personName: string; opportunityTitle: string; dimensions: { name: string; score: number; note: string }[]; uncertainty: string[] }): Promise<string>;
  /** Turn a natural-language query into structured search filters. */
  parseSearch(query: string): Promise<SearchIntent>;
}

export type SearchIntent = {
  text: string;
  capabilities: string[];
  locations: string[];
  routes: string[];
  availableSoon: boolean;
  workedWithOnly: boolean;
  sectors: string[];
};
