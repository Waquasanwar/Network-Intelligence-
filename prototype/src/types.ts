import type { AvailabilityStatus, EngagementRoute, Seniority, SourceType, RelationshipType, EvidenceType, HumanDecision, OpportunityStatus, IntroductionStatus, ConsentStatus, AdvisoryStatus, CommercialModel } from "@prisma/client";
import type { ExtractedSummary } from "@/lib/ai/types";
import type { AccountKind, Brief, BriefStatus, Terms, ShortlistDecision, HardCheck, FeeModel, FeeStatus, RateCard } from "@/lib/demand";

export type User = { id: string; name: string; role: "OWNER" | "CONTRIBUTOR" };
export type Person = {
  id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; linkedinUrl?: string | null;
  headline?: string | null; currentCompany?: string | null; currentRole?: string | null; primaryCity?: string | null; primaryCountry?: string | null;
  targetLocations: string[]; capabilities: string[]; sectors: string[]; seniority?: Seniority | null; engagementPreferences: EngagementRoute[];
  rateExpectation?: string | null; salaryExpectation?: string | null; noticePeriod?: string | null;
  availabilityStatus: AvailabilityStatus; availabilityConfirmedAt?: string | null; availabilitySource?: string | null; availabilityConfidence: number; nextCheckDate?: string | null;
  relocationInterest: boolean; workingStyle?: string | null; constraints?: string | null; nextAction?: string | null; nextActionDate?: string | null;
  workRights?: string[]; amanaBench: boolean; usedByAmana: boolean; createdAt: string; updatedAt: string;
};
export type Relationship = { id: string; personId: string; networkOwnerId: string; sourceType: SourceType; introducedById?: string | null; relationshipType: RelationshipType; workedTogether: boolean; workedTogetherContext?: string | null; yearsKnown?: number | null; wouldWorkTogetherAgain?: boolean | null; relationshipNotes?: string | null; lastContactDate?: string | null };
export type Evidence = { id: string; personId: string; observerId: string; evidenceType: EvidenceType; context: string; description: string; confidence: number; dateObserved?: string | null; visibility: "PRIVATE" | "TENANT" | "PARTNER_SAFE" };
export type Conversation = { id: string; personId: string; conductedById: string; date: string; type: string; rawNotes?: string | null; transcript?: string | null; aiSummary?: ExtractedSummary | null; approvedSummary?: ExtractedSummary | null; approvalStatus: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED"; followUpDate?: string | null; tags: string[] };
export type Scheduled = { id: string; personId: string; ownerId: string; provider: "MANUAL" | "MICROSOFT_GRAPH" | "CALENDLY"; startAt: string; endAt: string; meetingType: string; status: "SCHEDULED" | "COMPLETED" | "CANCELLED" };
export type Opportunity = { id: string; sourceType: "AMANA" | "PARTNER" | "DIRECT_CLIENT" | "FOUNDER" | "REFERRAL"; clientName?: string | null; partnerId?: string | null; title: string; problemStatement: string; desiredOutcomes?: string | null; engagementRoute: EngagementRoute; location?: string | null; duration?: string | null; startDate?: string | null; budget?: number | null; currency: string; requiredCapabilities: string[]; preferredCapabilities: string[]; sectors: string[]; seniority?: Seniority | null; status: OpportunityStatus; isAmana: boolean; createdAt: string; updatedAt: string };
export type Match = { id: string; opportunityId: string; personId: string; fitScore: number; fitExplanation: string; evidenceStrength: number; relationshipStrength: number; availabilityFit: number; commercialFit: number; uncertainty: string[]; humanDecision: HumanDecision; humanNotes?: string | null; approvedById?: string | null; updatedAt: string };
export type Introduction = { id: string; opportunityId: string; personId: string; requestedById: string; approvedById?: string | null; consentStatus: ConsentStatus; status: IntroductionStatus; route: EngagementRoute; recruitmentPartnerId?: string | null; commercialModel: CommercialModel; commercialSharePct?: number | null; commercialValue?: number | null; currency: string; notes?: string | null; createdAt: string };
export type TeamMember = { id: string; opportunityId: string; personId: string; roleOnTeam: string; notes?: string | null };
export type Partner = { id: string; name: string; contactName?: string | null; subscriptionStatus: "TRIAL" | "ACTIVE" | "PAUSED" | "CANCELLED"; subscriptionTier?: string | null; commercialModel: CommercialModel; commercialSharePct?: number | null; monthlyFee?: number | null; currency: string; licensedForPermanent: boolean; notes?: string | null };
export type PartnerRequirement = { id: string; partnerId: string; title: string; description: string; engagementRoute: EngagementRoute; location?: string | null; requiredCapabilities: string[]; seniority?: Seniority | null; budget?: string | null; status: "SUBMITTED" | "REVIEWING" | "RESULTS_SHARED" | "INTRO_REQUESTED" | "CLOSED"; linkedOpportunityId?: string | null; createdAt: string };
export type Relocation = { personId: string; currentLocation?: string | null; targetLocation?: string | null; targetMoveWindow?: string | null; familyMove: boolean; schoolGuidanceInterest: boolean; housingGuidanceInterest: boolean; relocationAdvisoryInterest: boolean; employerSponsored: boolean; advisoryStatus: AdvisoryStatus; notes?: string | null; updatedAt: string };
export type Account = { id: string; name: string; kind: AccountKind; contactName?: string | null; contactEmail?: string | null; status: "PROSPECT" | "ACTIVE" | "PAUSED"; currency: string; terms?: Partial<Terms> | null; monthlyFee?: number | null; partnerId?: string | null; notes?: string | null; portalEnabled: boolean; createdAt: string };
export type StoredBrief = Brief & { id: string; accountId: string; submittedVia: "OWNER" | "PORTAL"; status: BriefStatus; terms: Terms; expertHours?: number | null; termsAccepted: boolean; createdAt: string; updatedAt: string };
export type ShortlistItem = { id: string; briefId: string; personId: string; fitScore: number; fitExplanation: string; dimensions: { name: string; score: number; note: string }[]; uncertainty: string[]; checks: HardCheck[]; tier: "meets" | "conversation" | "stretch"; decision: ShortlistDecision; note?: string | null; clientNote?: string | null; createdAt: string; updatedAt: string };
export type FeeLine = { id: string; briefId: string; accountId: string; personId?: string | null; model: FeeModel; basis: string; gross: number; ourTake: number; currency: string; status: FeeStatus; createdAt: string; updatedAt: string };
export type AuditEntry = { id: string; actorId: string; action: string; entityType: string; entityId?: string | null; detail?: string | null; createdAt: string };

export type State = {
  users: User[]; me: User;
  people: Person[]; relationships: Relationship[]; evidence: Evidence[]; conversations: Conversation[]; scheduled: Scheduled[];
  opportunities: Opportunity[]; matches: Match[]; introductions: Introduction[]; team: TeamMember[];
  partners: Partner[]; requirements: PartnerRequirement[]; relocation: Relocation[]; audit: AuditEntry[];
  accounts: Account[]; briefs: StoredBrief[]; shortlist: ShortlistItem[]; fees: FeeLine[]; rateCard: RateCard;
  connections: string[];
};
