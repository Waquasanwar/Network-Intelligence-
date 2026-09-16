-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('PLATFORM_OWNER', 'CONSULTANCY', 'RECRUITMENT_PARTNER', 'DIRECT_CLIENT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'CONTRIBUTOR', 'PARTNER', 'CLIENT', 'MEMBER');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('ASSOCIATE', 'MANAGER', 'SENIOR_MANAGER', 'DIRECTOR', 'EXECUTIVE', 'C_LEVEL');

-- CreateEnum
CREATE TYPE "EngagementRoute" AS ENUM ('PERMANENT', 'CONTRACT', 'INTERIM', 'FRACTIONAL', 'ADVISORY', 'SOW');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE_NOW', 'OPEN_TO_CONVERSATIONS', 'QUIETLY_EXPLORING', 'RIGHT_OPPORTUNITY_ONLY', 'FINISHING_ENGAGEMENT_SOON', 'FRACTIONAL_AVAILABILITY', 'SOW_ONLY', 'PERMANENT_ONLY', 'CONTRACT_ONLY', 'HAPPY_WHERE_I_AM', 'NOT_LOOKING_KEEP_IN_TOUCH', 'UNAVAILABLE_UNTIL', 'TAKING_A_BREAK', 'NEEDS_REFRESH');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PERSONAL_NETWORK', 'INTRODUCTION', 'WORKED_TOGETHER', 'CLIENT', 'PARTNER_REFERRAL', 'EVENT', 'INBOUND', 'LINKEDIN', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('DIRECT', 'INTRODUCED', 'WORKED_WITH', 'MANAGED', 'REPORTED_TO', 'CLIENT_OF', 'PEER', 'MENTORED', 'KNOWS_OF');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DELIVERY_OBSERVED', 'REFERENCE', 'CLIENT_FEEDBACK', 'PEER_FEEDBACK', 'OUTCOME', 'CAUTION');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'TENANT', 'PARTNER_SAFE');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('INTRO_CALL', 'CATCH_UP', 'OPPORTUNITY_DISCUSSION', 'REFERENCE', 'IN_PERSON', 'MESSAGE_THREAD');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OpportunitySource" AS ENUM ('AMANA', 'PARTNER', 'DIRECT_CLIENT', 'FOUNDER', 'REFERRAL');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('INTAKE', 'QUALIFYING', 'MATCHING', 'SHORTLIST', 'INTRODUCING', 'ENGAGED', 'CLOSED_WON', 'CLOSED_LOST', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "HumanDecision" AS ENUM ('UNDECIDED', 'RECOMMEND', 'POSSIBLE', 'NEED_MORE_EVIDENCE', 'NOT_FOR_THIS_REQUIREMENT');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'GRANTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "IntroductionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'IDENTITY_REVEALED', 'INTRODUCED', 'IN_PROGRESS', 'ENGAGED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CommercialModel" AS ENUM ('NONE', 'INTRODUCTION_FEE', 'SUCCESS_SHARE', 'SUBSCRIPTION_INCLUDED', 'AMANA_SOW');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('SUBMITTED', 'REVIEWING', 'RESULTS_SHARED', 'INTRO_REQUESTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AdvisoryStatus" AS ENUM ('INTEREST_CAPTURED', 'DISCOVERY_CALL', 'PROPOSAL_SENT', 'ACTIVE', 'COMPLETED', 'NOT_PROCEEDING');

-- CreateEnum
CREATE TYPE "SchedulingProviderKind" AS ENUM ('MICROSOFT_GRAPH', 'CALENDLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PROPOSED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TenantType" NOT NULL,
    "brandName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CONTRIBUTOR',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "headline" TEXT,
    "currentCompany" TEXT,
    "currentRole" TEXT,
    "primaryCity" TEXT,
    "primaryCountry" TEXT,
    "targetLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" "Seniority",
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "engagementPreferences" "EngagementRoute"[] DEFAULT ARRAY[]::"EngagementRoute"[],
    "rateExpectation" TEXT,
    "salaryExpectation" TEXT,
    "noticePeriod" TEXT,
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'NEEDS_REFRESH',
    "availabilityDate" TIMESTAMP(3),
    "availabilityConfirmedAt" TIMESTAMP(3),
    "availabilitySource" TEXT,
    "availabilityConfidence" INTEGER NOT NULL DEFAULT 50,
    "nextCheckDate" TIMESTAMP(3),
    "opportunityInterest" TEXT,
    "relocationInterest" BOOLEAN NOT NULL DEFAULT false,
    "workingStyle" TEXT,
    "constraints" TEXT,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "amanaBench" BOOLEAN NOT NULL DEFAULT false,
    "usedByAmana" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "networkOwnerId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "introducedById" TEXT,
    "relationshipType" "RelationshipType" NOT NULL,
    "workedTogether" BOOLEAN NOT NULL DEFAULT false,
    "workedTogetherContext" TEXT,
    "yearsKnown" INTEGER,
    "wouldWorkTogetherAgain" BOOLEAN,
    "relationshipNotes" TEXT,
    "lastContactDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "context" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "dateObserved" TIMESTAMP(3),
    "visibility" "Visibility" NOT NULL DEFAULT 'TENANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "conductedById" TEXT NOT NULL,
    "scheduledEventId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'INTRO_CALL',
    "rawNotes" TEXT,
    "transcript" TEXT,
    "aiSummary" JSONB,
    "approvedSummary" JSONB,
    "approvedById" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "followUpDate" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "OpportunitySource" NOT NULL,
    "clientName" TEXT,
    "partnerId" TEXT,
    "title" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "desiredOutcomes" TEXT,
    "engagementRoute" "EngagementRoute" NOT NULL,
    "location" TEXT,
    "duration" TEXT,
    "startDate" TIMESTAMP(3),
    "budget" DECIMAL(14,2),
    "currency" TEXT DEFAULT 'GBP',
    "requiredCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" "Seniority",
    "status" "OpportunityStatus" NOT NULL DEFAULT 'INTAKE',
    "isAmana" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "fitExplanation" TEXT NOT NULL,
    "evidenceStrength" INTEGER NOT NULL,
    "relationshipStrength" INTEGER NOT NULL,
    "availabilityFit" INTEGER NOT NULL,
    "commercialFit" INTEGER NOT NULL,
    "uncertainty" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "humanDecision" "HumanDecision" NOT NULL DEFAULT 'UNDECIDED',
    "humanNotes" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Introduction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "introducedAt" TIMESTAMP(3),
    "status" "IntroductionStatus" NOT NULL DEFAULT 'REQUESTED',
    "route" "EngagementRoute" NOT NULL,
    "recruitmentPartnerId" TEXT,
    "commercialModel" "CommercialModel" NOT NULL DEFAULT 'NONE',
    "commercialSharePct" DECIMAL(5,2),
    "commercialValue" DECIMAL(14,2),
    "currency" TEXT DEFAULT 'GBP',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Introduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamShortlistMember" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleOnTeam" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamShortlistMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "subscriptionTier" TEXT,
    "commercialModel" "CommercialModel" NOT NULL DEFAULT 'SUCCESS_SHARE',
    "commercialSharePct" DECIMAL(5,2),
    "monthlyFee" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "licensedForPermanent" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerRequirement" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "engagementRoute" "EngagementRoute" NOT NULL,
    "location" TEXT,
    "requiredCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" "Seniority",
    "budget" TEXT,
    "status" "RequirementStatus" NOT NULL DEFAULT 'SUBMITTED',
    "linkedOpportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelocationProfile" (
    "personId" TEXT NOT NULL,
    "currentLocation" TEXT,
    "targetLocation" TEXT,
    "targetMoveWindow" TEXT,
    "familyMove" BOOLEAN NOT NULL DEFAULT false,
    "schoolGuidanceInterest" BOOLEAN NOT NULL DEFAULT false,
    "housingGuidanceInterest" BOOLEAN NOT NULL DEFAULT false,
    "relocationAdvisoryInterest" BOOLEAN NOT NULL DEFAULT false,
    "employerSponsored" BOOLEAN NOT NULL DEFAULT false,
    "advisoryStatus" "AdvisoryStatus" NOT NULL DEFAULT 'INTEREST_CAPTURED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelocationProfile_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "SchedulingConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SchedulingProviderKind" NOT NULL,
    "externalAccountId" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "encryptedCredentialReference" TEXT,

    CONSTRAINT "SchedulingConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "provider" "SchedulingProviderKind" NOT NULL,
    "externalEventId" TEXT,
    "eventUrl" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "meetingType" "ConversationType" NOT NULL DEFAULT 'INTRO_CALL',
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Person_tenantId_idx" ON "Person"("tenantId");

-- CreateIndex
CREATE INDEX "Person_tenantId_availabilityStatus_idx" ON "Person"("tenantId", "availabilityStatus");

-- CreateIndex
CREATE INDEX "Person_tenantId_lastName_firstName_idx" ON "Person"("tenantId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Relationship_personId_idx" ON "Relationship"("personId");

-- CreateIndex
CREATE INDEX "Relationship_networkOwnerId_idx" ON "Relationship"("networkOwnerId");

-- CreateIndex
CREATE INDEX "Evidence_personId_idx" ON "Evidence"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_scheduledEventId_key" ON "Conversation"("scheduledEventId");

-- CreateIndex
CREATE INDEX "Conversation_personId_idx" ON "Conversation"("personId");

-- CreateIndex
CREATE INDEX "Conversation_approvalStatus_idx" ON "Conversation"("approvalStatus");

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_status_idx" ON "Opportunity"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Match_opportunityId_personId_key" ON "Match"("opportunityId", "personId");

-- CreateIndex
CREATE INDEX "Introduction_tenantId_idx" ON "Introduction"("tenantId");

-- CreateIndex
CREATE INDEX "Introduction_opportunityId_idx" ON "Introduction"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamShortlistMember_opportunityId_personId_key" ON "TeamShortlistMember"("opportunityId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_tenantId_key" ON "Partner"("tenantId");

-- CreateIndex
CREATE INDEX "PartnerRequirement_partnerId_idx" ON "PartnerRequirement"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingConnection_userId_provider_key" ON "SchedulingConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "ScheduledConversation_tenantId_startAt_idx" ON "ScheduledConversation"("tenantId", "startAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_networkOwnerId_fkey" FOREIGN KEY ("networkOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_introducedById_fkey" FOREIGN KEY ("introducedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_scheduledEventId_fkey" FOREIGN KEY ("scheduledEventId") REFERENCES "ScheduledConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_recruitmentPartnerId_fkey" FOREIGN KEY ("recruitmentPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamShortlistMember" ADD CONSTRAINT "TeamShortlistMember_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamShortlistMember" ADD CONSTRAINT "TeamShortlistMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRequirement" ADD CONSTRAINT "PartnerRequirement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelocationProfile" ADD CONSTRAINT "RelocationProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingConnection" ADD CONSTRAINT "SchedulingConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledConversation" ADD CONSTRAINT "ScheduledConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledConversation" ADD CONSTRAINT "ScheduledConversation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledConversation" ADD CONSTRAINT "ScheduledConversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
