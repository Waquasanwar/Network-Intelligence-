import type {
  AvailabilityStatus,
  EngagementRoute,
  HumanDecision,
  OpportunityStatus,
  Seniority,
  SourceType,
  RelationshipType,
  EvidenceType,
  IntroductionStatus,
  AdvisoryStatus,
  RequirementStatus,
} from "@prisma/client";

// Product language (spec §5): Person, Expert, Relationship, Evidence, Conversation,
// Opportunity, Requirement, Match, Recommendation, Introduction, Engagement.

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE_NOW: "Available now",
  OPEN_TO_CONVERSATIONS: "Open to conversations",
  QUIETLY_EXPLORING: "Quietly exploring",
  RIGHT_OPPORTUNITY_ONLY: "Right opportunity only",
  FINISHING_ENGAGEMENT_SOON: "Finishing engagement soon",
  FRACTIONAL_AVAILABILITY: "Fractional availability",
  SOW_ONLY: "SOW only",
  PERMANENT_ONLY: "Permanent only",
  CONTRACT_ONLY: "Contract only",
  HAPPY_WHERE_I_AM: "Happy where I am",
  NOT_LOOKING_KEEP_IN_TOUCH: "Not looking — keep in touch",
  UNAVAILABLE_UNTIL: "Unavailable until date",
  TAKING_A_BREAK: "Taking a break",
  NEEDS_REFRESH: "Needs refresh",
};

// Tone: teal = healthy/trusted, amber = attention, neutral otherwise. Red only for risk.
export type Tone = "teal" | "amber" | "neutral" | "navy" | "risk";

export const AVAILABILITY_TONE: Record<AvailabilityStatus, Tone> = {
  AVAILABLE_NOW: "teal",
  OPEN_TO_CONVERSATIONS: "teal",
  QUIETLY_EXPLORING: "teal",
  RIGHT_OPPORTUNITY_ONLY: "navy",
  FINISHING_ENGAGEMENT_SOON: "teal",
  FRACTIONAL_AVAILABILITY: "teal",
  SOW_ONLY: "navy",
  PERMANENT_ONLY: "navy",
  CONTRACT_ONLY: "navy",
  HAPPY_WHERE_I_AM: "neutral",
  NOT_LOOKING_KEEP_IN_TOUCH: "neutral",
  UNAVAILABLE_UNTIL: "neutral",
  TAKING_A_BREAK: "neutral",
  NEEDS_REFRESH: "amber",
};

export const ROUTE_LABELS: Record<EngagementRoute, string> = {
  PERMANENT: "Permanent",
  CONTRACT: "Contract",
  INTERIM: "Interim",
  FRACTIONAL: "Fractional",
  ADVISORY: "Advisory",
  SOW: "SOW / project",
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  ASSOCIATE: "Associate",
  MANAGER: "Manager",
  SENIOR_MANAGER: "Senior manager",
  DIRECTOR: "Director",
  EXECUTIVE: "Executive",
  C_LEVEL: "C-level",
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  PERSONAL_NETWORK: "Personal network",
  INTRODUCTION: "Introduction",
  WORKED_TOGETHER: "Worked together",
  CLIENT: "Client",
  PARTNER_REFERRAL: "Partner referral",
  EVENT: "Event",
  INBOUND: "Inbound",
  LINKEDIN: "LinkedIn",
  OTHER: "Other",
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  DIRECT: "Direct relationship",
  INTRODUCED: "Introduced",
  WORKED_WITH: "Worked with",
  MANAGED: "Managed them",
  REPORTED_TO: "Reported to them",
  CLIENT_OF: "Client of",
  PEER: "Peer",
  MENTORED: "Mentored",
  KNOWS_OF: "Knows of",
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  DELIVERY_OBSERVED: "Delivery observed",
  REFERENCE: "Reference",
  CLIENT_FEEDBACK: "Client feedback",
  PEER_FEEDBACK: "Peer feedback",
  OUTCOME: "Outcome",
  CAUTION: "Caution",
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  INTAKE: "Intake",
  QUALIFYING: "Qualifying",
  MATCHING: "Matching",
  SHORTLIST: "Shortlist",
  INTRODUCING: "Introducing",
  ENGAGED: "Engaged",
  CLOSED_WON: "Closed — won",
  CLOSED_LOST: "Closed — lost",
  ON_HOLD: "On hold",
};

export const KANBAN_STAGES: OpportunityStatus[] = [
  "INTAKE",
  "QUALIFYING",
  "MATCHING",
  "SHORTLIST",
  "INTRODUCING",
  "ENGAGED",
];

export const DECISION_LABELS: Record<HumanDecision, string> = {
  UNDECIDED: "Undecided",
  RECOMMEND: "Recommend",
  POSSIBLE: "Possible",
  NEED_MORE_EVIDENCE: "Need more evidence",
  NOT_FOR_THIS_REQUIREMENT: "Not for this requirement",
};

export const DECISION_TONE: Record<HumanDecision, Tone> = {
  UNDECIDED: "neutral",
  RECOMMEND: "teal",
  POSSIBLE: "navy",
  NEED_MORE_EVIDENCE: "amber",
  NOT_FOR_THIS_REQUIREMENT: "neutral",
};

export const INTRO_STATUS_LABELS: Record<IntroductionStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  IDENTITY_REVEALED: "Identity revealed",
  INTRODUCED: "Introduced",
  IN_PROGRESS: "In progress",
  ENGAGED: "Engaged",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

export const ADVISORY_LABELS: Record<AdvisoryStatus, string> = {
  INTEREST_CAPTURED: "Interest captured",
  DISCOVERY_CALL: "Discovery call",
  PROPOSAL_SENT: "Proposal sent",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  NOT_PROCEEDING: "Not proceeding",
};

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  SUBMITTED: "Submitted",
  REVIEWING: "Reviewing",
  RESULTS_SHARED: "Results shared",
  INTRO_REQUESTED: "Introduction requested",
  CLOSED: "Closed",
};

// Conversation prompts (spec §9, step 3) — natural, not a script
export const CONVERSATION_PROMPTS = [
  "What are you genuinely good at?",
  "What problems do people usually bring you in to solve?",
  "What kind of work gives you energy?",
  "What do you not want to do anymore?",
  "What environment gets the best from you?",
  "What are you considering next?",
  "Permanent, contract, fractional, advisory or SOW?",
  "What would make you consider UAE / UK / Saudi?",
  "What would someone who worked closely with you say about you?",
  "What would make you reject an opportunity?",
];
