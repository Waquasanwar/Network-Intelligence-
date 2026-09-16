import { PrismaClient, type AvailabilityStatus, type EngagementRoute, type Seniority, type HumanDecision } from "@prisma/client";
import { hash } from "bcryptjs";
import { retrieveMatches } from "../src/lib/matching";
import { suggestNextCheck } from "../src/lib/availability";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

type SeedPerson = {
  key: string;
  firstName: string;
  lastName: string;
  headline: string;
  currentCompany: string;
  currentRole: string;
  city: string;
  country: string;
  targetLocations?: string[];
  capabilities: string[];
  sectors: string[];
  seniority: Seniority;
  routes: EngagementRoute[];
  rate?: string;
  salary?: string;
  status: AvailabilityStatus;
  confirmedDaysAgo: number | null;
  relocation?: boolean;
  amanaBench?: boolean;
  usedByAmana?: boolean;
  email?: string;
  nextAction?: string;
};

const PEOPLE: SeedPerson[] = [
  { key: "sarah", firstName: "Sarah", lastName: "Okonkwo", headline: "Programme director who stabilises troubled transformations", currentCompany: "Independent", currentRole: "Programme Director", city: "London", country: "UK", targetLocations: ["Dubai", "Riyadh"], capabilities: ["Programme director", "Transformation", "Systems integrator challenge", "Turnaround", "Stakeholder management"], sectors: ["Banking", "Financial services"], seniority: "DIRECTOR", routes: ["INTERIM", "CONTRACT", "SOW"], rate: "£1,350/day", status: "FINISHING_ENGAGEMENT_SOON", confirmedDaysAgo: 6, relocation: true, amanaBench: true, usedByAmana: true, email: "sarah.okonkwo@example.com", nextAction: "Confirm end date of current programme" },
  { key: "daniel", firstName: "Daniel", lastName: "Reyes", headline: "CISO / security architecture, regulated industries", currentCompany: "Northgate Insurance", currentRole: "Deputy CISO", city: "Manchester", country: "UK", capabilities: ["Cyber security", "Security architecture", "CISO", "Identity and access", "Regulatory"], sectors: ["Insurance", "Financial services"], seniority: "EXECUTIVE", routes: ["FRACTIONAL", "ADVISORY", "PERMANENT"], salary: "£185k", status: "QUIETLY_EXPLORING", confirmedDaysAgo: 20, amanaBench: true, email: "daniel.reyes@example.com", nextAction: "Send fractional CISO framing" },
  { key: "amira", firstName: "Amira", lastName: "Haddad", headline: "Data platform and AI delivery lead", currentCompany: "Gulf Capital Partners", currentRole: "Head of Data", city: "Dubai", country: "UAE", capabilities: ["Data platform", "Data engineering", "AI", "Machine learning", "Azure", "Delivery lead"], sectors: ["Sovereign wealth", "Financial services"], seniority: "SENIOR_MANAGER", routes: ["PERMANENT", "SOW"], salary: "AED 65k/month", status: "RIGHT_OPPORTUNITY_ONLY", confirmedDaysAgo: 35, amanaBench: true, usedByAmana: true, email: "amira.haddad@example.com" },
  { key: "tom", firstName: "Tom", lastName: "Whitfield", headline: "Fractional CFO for scale-ups and carve-outs", currentCompany: "Whitfield Advisory", currentRole: "Fractional CFO", city: "Edinburgh", country: "UK", capabilities: ["Finance transformation", "CFO", "M&A integration", "Commercial", "Governance"], sectors: ["Technology", "Retail"], seniority: "EXECUTIVE", routes: ["FRACTIONAL", "ADVISORY"], rate: "£1,600/day", status: "FRACTIONAL_AVAILABILITY", confirmedDaysAgo: 12, email: "tom.whitfield@example.com" },
  { key: "priya", firstName: "Priya", lastName: "Natarajan", headline: "Change and target operating model lead", currentCompany: "Independent", currentRole: "Change Director", city: "London", country: "UK", targetLocations: ["Abu Dhabi"], capabilities: ["Change management", "Target operating model", "Transformation", "PMO", "Stakeholder management"], sectors: ["Public sector", "Healthcare"], seniority: "DIRECTOR", routes: ["CONTRACT", "SOW", "INTERIM"], rate: "£1,100/day", status: "AVAILABLE_NOW", confirmedDaysAgo: 3, amanaBench: true, usedByAmana: true, email: "priya.n@example.com", nextAction: "Introduce to Meridian if route confirmed" },
  { key: "james", firstName: "James", lastName: "Carrick", headline: "ERP programme lead (SAP S/4)", currentCompany: "Carrick Delivery Ltd", currentRole: "Programme Lead", city: "Birmingham", country: "UK", capabilities: ["SAP", "ERP", "Programme management", "Vendor management", "Systems integrator challenge"], sectors: ["Manufacturing", "Utilities"], seniority: "DIRECTOR", routes: ["CONTRACT", "SOW"], rate: "£1,250/day", status: "NEEDS_REFRESH", confirmedDaysAgo: 120, email: "james.carrick@example.com", nextAction: "Reconnect — status stale" },
  { key: "layla", firstName: "Layla", lastName: "Mansour", headline: "Enterprise architect, cloud and integration", currentCompany: "Riyadh Digital Authority", currentRole: "Chief Architect", city: "Riyadh", country: "Saudi Arabia", capabilities: ["Enterprise architecture", "Cloud", "AWS", "Solution architecture", "Governance"], sectors: ["Government", "Public sector"], seniority: "EXECUTIVE", routes: ["ADVISORY", "SOW"], rate: "SAR 6,500/day", status: "SOW_ONLY", confirmedDaysAgo: 28, amanaBench: true, email: "layla.mansour@example.com" },
  { key: "oliver", firstName: "Oliver", lastName: "Bennett", headline: "Product and agile delivery leader", currentCompany: "Fintech scale-up", currentRole: "VP Product", city: "London", country: "UK", capabilities: ["Product management", "Agile delivery", "Platform engineering", "Stakeholder management"], sectors: ["Financial services", "Technology"], seniority: "SENIOR_MANAGER", routes: ["PERMANENT"], salary: "£160k + equity", status: "HAPPY_WHERE_I_AM", confirmedDaysAgo: 40, email: "oliver.bennett@example.com" },
  { key: "fatima", firstName: "Fatima", lastName: "Al Rashid", headline: "Cyber governance, risk and compliance", currentCompany: "Independent", currentRole: "GRC Consultant", city: "Abu Dhabi", country: "UAE", capabilities: ["Cyber security", "Governance", "Risk", "Compliance", "Regulatory"], sectors: ["Energy", "Government"], seniority: "MANAGER", routes: ["CONTRACT", "SOW"], rate: "AED 4,200/day", status: "AVAILABLE_NOW", confirmedDaysAgo: 8, amanaBench: true, email: "fatima.ar@example.com" },
  { key: "marcus", firstName: "Marcus", lastName: "Doyle", headline: "Interim COO, operations turnaround", currentCompany: "Independent", currentRole: "Interim COO", city: "Leeds", country: "UK", targetLocations: ["Dubai"], capabilities: ["Operations", "Turnaround", "COO", "Supply chain", "Target operating model"], sectors: ["Logistics", "Retail"], seniority: "C_LEVEL", routes: ["INTERIM", "FRACTIONAL"], rate: "£1,800/day", status: "OPEN_TO_CONVERSATIONS", confirmedDaysAgo: 15, relocation: true, email: "marcus.doyle@example.com" },
  { key: "hannah", firstName: "Hannah", lastName: "Lindqvist", headline: "GenAI strategy and responsible AI", currentCompany: "Nordic Bank", currentRole: "Head of AI", city: "London", country: "UK", capabilities: ["AI", "GenAI", "Data strategy", "Governance", "Machine learning"], sectors: ["Banking", "Financial services"], seniority: "DIRECTOR", routes: ["ADVISORY", "FRACTIONAL"], rate: "£1,900/day", status: "RIGHT_OPPORTUNITY_ONLY", confirmedDaysAgo: 22, amanaBench: true, email: "hannah.l@example.com" },
  { key: "ravi", firstName: "Ravi", lastName: "Menon", headline: "PMO and portfolio governance", currentCompany: "Carrick Delivery Ltd", currentRole: "PMO Lead", city: "Birmingham", country: "UK", capabilities: ["PMO", "Project management", "Governance", "Programme management"], sectors: ["Utilities", "Manufacturing"], seniority: "MANAGER", routes: ["CONTRACT", "SOW"], rate: "£650/day", status: "OPEN_TO_CONVERSATIONS", confirmedDaysAgo: 50, usedByAmana: true, email: "ravi.menon@example.com" },
  { key: "chloe", firstName: "Chloe", lastName: "Martin", headline: "ServiceNow and IT operating model", currentCompany: "Independent", currentRole: "Platform Lead", city: "Bristol", country: "UK", capabilities: ["ServiceNow", "Target operating model", "Platform engineering", "Vendor management"], sectors: ["Telecoms", "Public sector"], seniority: "SENIOR_MANAGER", routes: ["CONTRACT"], rate: "£850/day", status: "CONTRACT_ONLY", confirmedDaysAgo: 10, email: "chloe.martin@example.com" },
  { key: "khalid", firstName: "Khalid", lastName: "Farouk", headline: "Bid and proposal director, GCC public sector", currentCompany: "Independent", currentRole: "Bid Director", city: "Dubai", country: "UAE", capabilities: ["Bid management", "Proposal", "Commercial", "SOW", "Stakeholder management"], sectors: ["Government", "Defence"], seniority: "DIRECTOR", routes: ["SOW", "ADVISORY"], rate: "AED 5,000/day", status: "NOT_LOOKING_KEEP_IN_TOUCH", confirmedDaysAgo: 30, usedByAmana: true, amanaBench: true, email: "khalid.f@example.com" },
  { key: "emma", firstName: "Emma", lastName: "Fitzgerald", headline: "Regulatory change and compliance programmes", currentCompany: "Global Bank", currentRole: "Head of Regulatory Change", city: "London", country: "UK", capabilities: ["Regulatory", "Compliance", "Programme management", "Change management"], sectors: ["Banking"], seniority: "DIRECTOR", routes: ["PERMANENT"], salary: "£175k", status: "QUIETLY_EXPLORING", confirmedDaysAgo: 9, email: "emma.f@example.com" },
  { key: "yusuf", firstName: "Yusuf", lastName: "Demir", headline: "DevOps and platform engineering lead", currentCompany: "Independent", currentRole: "Platform Engineering Lead", city: "London", country: "UK", targetLocations: ["Remote", "Dubai"], capabilities: ["DevOps", "Platform engineering", "Cloud", "Azure", "Engineering lead"], sectors: ["Technology", "Media"], seniority: "SENIOR_MANAGER", routes: ["CONTRACT", "SOW"], rate: "£900/day", status: "TAKING_A_BREAK", confirmedDaysAgo: 18, email: "yusuf.d@example.com" },
  { key: "grace", firstName: "Grace", lastName: "Adeyemi", headline: "Procurement and supply chain transformation", currentCompany: "Independent", currentRole: "Procurement Director", city: "London", country: "UK", capabilities: ["Procurement", "Supply chain", "Transformation", "Commercial", "Vendor management"], sectors: ["Retail", "Consumer", "Public sector"], seniority: "DIRECTOR", routes: ["INTERIM", "CONTRACT"], rate: "£1,000/day", status: "NEEDS_REFRESH", confirmedDaysAgo: null, email: "grace.a@example.com", nextAction: "First proper conversation not yet held" },
  { key: "ben", firstName: "Ben", lastName: "Hughes", headline: "Referred by Sarah — programme recovery, SI management", currentCompany: "Unknown", currentRole: "Programme Manager", city: "London", country: "UK", capabilities: ["Programme management", "Recovery", "Systems integrator challenge"], sectors: ["Insurance"], seniority: "SENIOR_MANAGER", routes: [], status: "NEEDS_REFRESH", confirmedDaysAgo: null, nextAction: "Book intro conversation" },
];

async function main() {
  console.log("Seeding…");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.teamShortlistMember.deleteMany(),
    prisma.introduction.deleteMany(),
    prisma.match.deleteMany(),
    prisma.partnerRequirement.deleteMany(),
    prisma.opportunity.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.scheduledConversation.deleteMany(),
    prisma.evidence.deleteMany(),
    prisma.relationship.deleteMany(),
    prisma.relocationProfile.deleteMany(),
    prisma.person.deleteMany(),
    prisma.schedulingConnection.deleteMany(),
    prisma.savedView.deleteMany(),
    prisma.partner.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const founderTenant = await prisma.tenant.create({ data: { slug: "founder", name: "Network Intelligence", type: "PLATFORM_OWNER", brandName: "Network Intelligence" } });
  const partnerTenant = await prisma.tenant.create({ data: { slug: "harbour-search", name: "Harbour Search", type: "RECRUITMENT_PARTNER", brandName: "Harbour Search" } });
  const clientTenant = await prisma.tenant.create({ data: { slug: "meridian-energy", name: "Meridian Energy", type: "DIRECT_CLIENT", brandName: "Meridian Energy" } });

  const waqas = await prisma.user.create({ data: { tenantId: founderTenant.id, email: "waqas@networkintelligence.local", name: "Waqas Anwar", role: "OWNER", passwordHash, mfaEnabled: true, lastLoginAt: daysAgo(0) } });
  const richard = await prisma.user.create({ data: { tenantId: founderTenant.id, email: "richard@amana.local", name: "Richard Cole", role: "CONTRIBUTOR", passwordHash, lastLoginAt: daysAgo(2) } });
  const soban = await prisma.user.create({ data: { tenantId: founderTenant.id, email: "soban@amana.local", name: "Soban Malik", role: "CONTRIBUTOR", passwordHash, lastLoginAt: daysAgo(1) } });
  const partnerUser = await prisma.user.create({ data: { tenantId: partnerTenant.id, email: "partner@harboursearch.local", name: "Jo Harbour", role: "PARTNER", passwordHash } });
  const clientUser = await prisma.user.create({ data: { tenantId: clientTenant.id, email: "client@meridian.local", name: "Nadia Stone", role: "CLIENT", passwordHash } });

  await prisma.schedulingConnection.create({ data: { userId: waqas.id, provider: "MANUAL", scopes: [] } });

  const partner = await prisma.partner.create({
    data: {
      tenantId: partnerTenant.id,
      name: "Harbour Search",
      contactName: "Jo Harbour",
      contactEmail: "partner@harboursearch.local",
      subscriptionStatus: "ACTIVE",
      subscriptionTier: "Standard",
      commercialModel: "SUCCESS_SHARE",
      commercialSharePct: 15,
      monthlyFee: 1500,
      currency: "GBP",
      licensedForPermanent: true,
      notes: "Licensed recruiter for permanent placements in UK financial services.",
    },
  });
  await prisma.partner.create({
    data: {
      tenantId: (await prisma.tenant.create({ data: { slug: "gulf-talent-partners", name: "Gulf Talent Partners", type: "RECRUITMENT_PARTNER" } })).id,
      name: "Gulf Talent Partners",
      contactName: "Omar Siddiqui",
      subscriptionStatus: "TRIAL",
      subscriptionTier: "Trial",
      commercialModel: "INTRODUCTION_FEE",
      commercialSharePct: 12.5,
      currency: "AED",
      notes: "Trial — UAE/KSA permanent and interim.",
    },
  });

  // People
  const people: Record<string, { id: string }> = {};
  for (const p of PEOPLE) {
    const confirmedAt = p.confirmedDaysAgo === null ? null : daysAgo(p.confirmedDaysAgo);
    people[p.key] = await prisma.person.create({
      data: {
        tenantId: founderTenant.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        headline: p.headline,
        currentCompany: p.currentCompany,
        currentRole: p.currentRole,
        primaryCity: p.city,
        primaryCountry: p.country,
        targetLocations: p.targetLocations ?? [],
        capabilities: p.capabilities,
        sectors: p.sectors,
        seniority: p.seniority,
        engagementPreferences: p.routes,
        rateExpectation: p.rate,
        salaryExpectation: p.salary,
        availabilityStatus: p.status,
        availabilityConfirmedAt: confirmedAt,
        availabilitySource: confirmedAt ? "conversation" : null,
        availabilityConfidence: confirmedAt ? 80 : 30,
        nextCheckDate: confirmedAt ? suggestNextCheck(p.status, confirmedAt) : null,
        relocationInterest: p.relocation ?? false,
        amanaBench: p.amanaBench ?? false,
        usedByAmana: p.usedByAmana ?? false,
        nextAction: p.nextAction,
        nextActionDate: p.nextAction ? daysAhead(Math.floor(Math.random() * 10) + 1) : null,
        createdAt: daysAgo(Math.floor(Math.random() * 200) + 10),
      },
    });
  }

  // Relationships — provenance is mandatory
  const rel = (key: string, owner: string, data: Parameters<typeof prisma.relationship.create>[0]["data"] extends infer D ? Omit<D, "personId" | "networkOwnerId" | "person" | "networkOwner"> : never) =>
    prisma.relationship.create({ data: { ...(data as object), personId: people[key].id, networkOwnerId: owner } as never });

  await rel("sarah", waqas.id, { sourceType: "WORKED_TOGETHER", relationshipType: "WORKED_WITH", workedTogether: true, workedTogetherContext: "Core banking replacement programme, 2021–2022. She took over a red programme and got it to amber in a quarter.", yearsKnown: 6, wouldWorkTogetherAgain: true, relationshipNotes: "Direct, no-nonsense. Do not position on greenfield builds — she is best in recovery. Prefers a call over email.", lastContactDate: daysAgo(6) });
  await rel("daniel", waqas.id, { sourceType: "PERSONAL_NETWORK", relationshipType: "DIRECT", workedTogether: false, yearsKnown: 4, wouldWorkTogetherAgain: null, relationshipNotes: "Met through the CISO round table. Thoughtful, not a self-promoter. Has an equity vesting cliff in Q1.", lastContactDate: daysAgo(20) });
  await rel("amira", richard.id, { sourceType: "CLIENT", relationshipType: "CLIENT_OF", workedTogether: true, workedTogetherContext: "Amana data platform SOW for GCP, 2024.", yearsKnown: 2, wouldWorkTogetherAgain: true, relationshipNotes: "Excellent with executive stakeholders. Would need visa/relocation support for UK.", lastContactDate: daysAgo(35) });
  await rel("tom", waqas.id, { sourceType: "INTRODUCTION", introducedById: people["sarah"].id, relationshipType: "INTRODUCED", workedTogether: false, yearsKnown: 1, relationshipNotes: "Sarah rates him for carve-outs. Not yet seen him deliver ourselves.", lastContactDate: daysAgo(12) });
  await rel("priya", waqas.id, { sourceType: "WORKED_TOGETHER", relationshipType: "MANAGED", workedTogether: true, workedTogetherContext: "NHS trust operating model redesign — Priya ran the change workstream for me.", yearsKnown: 5, wouldWorkTogetherAgain: true, relationshipNotes: "Calm under pressure. Good with clinicians. Wants a Gulf move for family reasons within 12 months.", lastContactDate: daysAgo(3) });
  await rel("priya", soban.id, { sourceType: "WORKED_TOGETHER", relationshipType: "PEER", workedTogether: true, workedTogetherContext: "Amana public sector SOW, 2025.", yearsKnown: 1, wouldWorkTogetherAgain: true, lastContactDate: daysAgo(30) });
  await rel("james", waqas.id, { sourceType: "PERSONAL_NETWORK", relationshipType: "KNOWS_OF", workedTogether: false, yearsKnown: 3, relationshipNotes: "Solid SAP lead by reputation. Have not spoken since early this year.", lastContactDate: daysAgo(120) });
  await rel("layla", soban.id, { sourceType: "CLIENT", relationshipType: "CLIENT_OF", workedTogether: true, workedTogetherContext: "Architecture review for a Riyadh government entity.", yearsKnown: 2, wouldWorkTogetherAgain: true, relationshipNotes: "Very senior in KSA government circles; advisory only, will not do hands-on delivery.", lastContactDate: daysAgo(28) });
  await rel("oliver", waqas.id, { sourceType: "EVENT", relationshipType: "DIRECT", workedTogether: false, yearsKnown: 2, lastContactDate: daysAgo(40) });
  await rel("fatima", richard.id, { sourceType: "PARTNER_REFERRAL", relationshipType: "INTRODUCED", introducedById: people["layla"].id, workedTogether: false, yearsKnown: 1, relationshipNotes: "Layla vouches for her GRC work on an energy regulator programme.", lastContactDate: daysAgo(8) });
  await rel("marcus", waqas.id, { sourceType: "WORKED_TOGETHER", relationshipType: "WORKED_WITH", workedTogether: true, workedTogetherContext: "Logistics turnaround, 2019. He ran ops while I ran the programme.", yearsKnown: 7, wouldWorkTogetherAgain: true, relationshipNotes: "Blunt. Great in a crisis, bored in steady state. Family open to Dubai.", lastContactDate: daysAgo(15) });
  await rel("hannah", waqas.id, { sourceType: "INTRODUCTION", introducedById: people["daniel"].id, relationshipType: "INTRODUCED", workedTogether: false, yearsKnown: 1, relationshipNotes: "Daniel introduced her. Strong on responsible AI governance; interested in fractional advisory in the Gulf.", lastContactDate: daysAgo(22) });
  await rel("ravi", waqas.id, { sourceType: "WORKED_TOGETHER", relationshipType: "MANAGED", workedTogether: true, workedTogetherContext: "PMO lead on my utilities programme.", yearsKnown: 4, wouldWorkTogetherAgain: true, lastContactDate: daysAgo(50) });
  await rel("chloe", soban.id, { sourceType: "LINKEDIN", relationshipType: "DIRECT", workedTogether: false, yearsKnown: 1, lastContactDate: daysAgo(10) });
  await rel("khalid", richard.id, { sourceType: "WORKED_TOGETHER", relationshipType: "WORKED_WITH", workedTogether: true, workedTogetherContext: "Two Amana bids in 2025, both won.", yearsKnown: 3, wouldWorkTogetherAgain: true, relationshipNotes: "Our go-to for GCC public sector bids. Keep warm even when not looking.", lastContactDate: daysAgo(30) });
  await rel("emma", waqas.id, { sourceType: "PERSONAL_NETWORK", relationshipType: "PEER", workedTogether: false, yearsKnown: 8, relationshipNotes: "Long-standing contact. Exploring quietly; must not be approached via her employer.", lastContactDate: daysAgo(9) });
  await rel("yusuf", waqas.id, { sourceType: "WORKED_TOGETHER", relationshipType: "WORKED_WITH", workedTogether: true, workedTogetherContext: "Platform rebuild for a media client.", yearsKnown: 3, wouldWorkTogetherAgain: false, relationshipNotes: "Technically excellent but clashed badly with the client PMO. Would not put him in a politically sensitive environment again.", lastContactDate: daysAgo(18) });
  await rel("grace", waqas.id, { sourceType: "INBOUND", relationshipType: "KNOWS_OF", workedTogether: false, yearsKnown: 0, relationshipNotes: "Reached out via LinkedIn after a talk. Not yet spoken.", lastContactDate: daysAgo(4) });
  await rel("ben", waqas.id, { sourceType: "INTRODUCTION", introducedById: people["sarah"].id, relationshipType: "INTRODUCED", workedTogether: false, yearsKnown: 0, relationshipNotes: "Sarah says he ran SI recovery under her. Referral only — no direct evidence yet.", lastContactDate: daysAgo(2) });

  // Evidence
  const ev = (key: string, observerId: string, data: { evidenceType: "DELIVERY_OBSERVED" | "REFERENCE" | "CLIENT_FEEDBACK" | "PEER_FEEDBACK" | "OUTCOME" | "CAUTION"; context: string; description: string; confidence: number; daysAgo: number; visibility?: "PRIVATE" | "TENANT" | "PARTNER_SAFE" }) =>
    prisma.evidence.create({ data: { personId: people[key].id, observerId, evidenceType: data.evidenceType, context: data.context, description: data.description, confidence: data.confidence, dateObserved: daysAgo(data.daysAgo), visibility: data.visibility ?? "TENANT" } });

  await ev("sarah", waqas.id, { evidenceType: "DELIVERY_OBSERVED", context: "Transformation programme recovery, banking", description: "Took a red core-banking programme to amber within one quarter; re-baselined the SI contract and removed two underperforming workstream leads.", confidence: 95, daysAgo: 900, visibility: "PARTNER_SAFE" });
  await ev("sarah", waqas.id, { evidenceType: "CLIENT_FEEDBACK", context: "Systems integrator challenge", description: "CIO said she was 'the only person the SI was afraid of'.", confidence: 85, daysAgo: 800 });
  await ev("priya", waqas.id, { evidenceType: "DELIVERY_OBSERVED", context: "Change management, healthcare operating model", description: "Ran the change workstream across 14 clinical directorates; adoption above target.", confidence: 90, daysAgo: 600, visibility: "PARTNER_SAFE" });
  await ev("priya", soban.id, { evidenceType: "OUTCOME", context: "Public sector SOW", description: "Amana SOW delivered on time; client extended by three months.", confidence: 85, daysAgo: 120 });
  await ev("amira", richard.id, { evidenceType: "DELIVERY_OBSERVED", context: "Data platform, Azure", description: "Led the Azure data platform build for GCP; strong executive stakeholder handling.", confidence: 90, daysAgo: 400 });
  await ev("marcus", waqas.id, { evidenceType: "DELIVERY_OBSERVED", context: "Operations turnaround, logistics", description: "Cut backlog by 60% in 8 weeks; rebuilt the shift model.", confidence: 90, daysAgo: 2000 });
  await ev("khalid", richard.id, { evidenceType: "OUTCOME", context: "Bid management, GCC public sector", description: "Two Amana bids won with Khalid leading the proposal.", confidence: 95, daysAgo: 200 });
  await ev("layla", soban.id, { evidenceType: "CLIENT_FEEDBACK", context: "Enterprise architecture, government", description: "Client cited her review as the reason they paused a failing platform migration.", confidence: 80, daysAgo: 300 });
  await ev("ravi", waqas.id, { evidenceType: "DELIVERY_OBSERVED", context: "PMO governance", description: "Reliable PMO; brought the portfolio reporting from monthly to weekly.", confidence: 75, daysAgo: 900 });
  await ev("yusuf", waqas.id, { evidenceType: "DELIVERY_OBSERVED", context: "Platform engineering", description: "Delivered a solid CI/CD platform rebuild.", confidence: 85, daysAgo: 500 });
  await ev("yusuf", waqas.id, { evidenceType: "CAUTION", context: "Stakeholder handling", description: "Repeated conflict with client PMO; needs a strong delivery lead above him.", confidence: 85, daysAgo: 480, visibility: "PRIVATE" });
  await ev("fatima", richard.id, { evidenceType: "REFERENCE", context: "Cyber GRC, energy regulator", description: "Layla Mansour vouches for her GRC delivery.", confidence: 65, daysAgo: 60 });
  await ev("daniel", waqas.id, { evidenceType: "PEER_FEEDBACK", context: "Security architecture", description: "Two CISOs in the round table independently described his identity programme as best in class.", confidence: 70, daysAgo: 100 });

  // Conversations
  const conv = async (key: string, by: string, data: { daysAgo: number; type?: "INTRO_CALL" | "CATCH_UP" | "OPPORTUNITY_DISCUSSION" | "REFERENCE" | "IN_PERSON" | "MESSAGE_THREAD"; rawNotes: string; status: "DRAFT" | "NEEDS_REVIEW" | "APPROVED"; summary?: object; followUp?: number; tags?: string[] }) =>
    prisma.conversation.create({
      data: {
        personId: people[key].id,
        conductedById: by,
        date: daysAgo(data.daysAgo),
        type: data.type ?? "CATCH_UP",
        rawNotes: data.rawNotes,
        aiSummary: data.summary,
        approvedSummary: data.status === "APPROVED" ? data.summary : undefined,
        approvedById: data.status === "APPROVED" ? by : null,
        approvalStatus: data.status,
        followUpDate: data.followUp ? daysAhead(data.followUp) : null,
        tags: data.tags ?? [],
        consentReference: "verbal-consent-on-call",
      },
    });

  await conv("sarah", waqas.id, { daysAgo: 6, type: "CATCH_UP", rawNotes: "Sarah is finishing the current programme at the end of next month. Wants another recovery, ideally banking or insurance. Open to Dubai for the right client, family would follow. Day rate £1,350, could flex for a 12-month SOW. Does not want a greenfield build. Follow up in three weeks.", status: "APPROVED", followUp: 15, tags: ["recovery", "dubai"], summary: { headline: "Programme recovery specialist, finishing engagement next month", capabilities: ["programme director", "transformation", "systems integrator challenge", "turnaround"], sectors: ["banking", "insurance"], engagementPreferences: ["INTERIM", "SOW"], locationPreferences: ["london", "dubai"], currentStatus: "Finishing current programme at end of next month", suggestedAvailabilityStatus: "FINISHING_ENGAGEMENT_SOON", ratesOrSalary: "£1,350/day, flexible for 12-month SOW", workingCharacteristics: ["Direct", "Best in recovery situations"], constraints: ["No greenfield builds"], strengths: ["Taking red programmes to amber", "Managing systems integrators"], avoid: ["Greenfield builds"], followUpDate: "in three weeks", unresolvedQuestions: ["Exact end date of current programme"], summary: "Finishing next month; wants recovery work in banking/insurance; open to Dubai." } });
  await conv("priya", waqas.id, { daysAgo: 3, type: "CATCH_UP", rawNotes: "Priya rolled off last Friday and is available now. Actively wants a Gulf move within 12 months — school places are the constraint (September intake). Prefers SOW or contract; would consider interim. £1,100/day in UK, would look at AED equivalent. Keen on Abu Dhabi. Asked about the relocation advisory.", status: "APPROVED", followUp: 7, tags: ["available", "relocation", "abu dhabi"], summary: { headline: "Change director, available now, wants Gulf move within 12 months", capabilities: ["change management", "target operating model", "transformation"], sectors: ["public sector", "healthcare"], engagementPreferences: ["SOW", "CONTRACT", "INTERIM"], locationPreferences: ["abu dhabi", "uae"], currentStatus: "Available now", suggestedAvailabilityStatus: "AVAILABLE_NOW", ratesOrSalary: "£1,100/day", workingCharacteristics: ["Calm under pressure", "Strong with clinicians"], constraints: ["School places — September intake"], strengths: ["Large-scale change adoption"], avoid: [], followUpDate: "one week", unresolvedQuestions: ["AED rate expectation"], summary: "Available now; SOW/contract preferred; Abu Dhabi move within 12 months, school constraint." } });
  await conv("daniel", waqas.id, { daysAgo: 20, type: "INTRO_CALL", rawNotes: "Daniel is quietly exploring. Not actively looking but would consider a fractional CISO role two days a week alongside his current job if his employer allowed it, or a full move for a Group CISO title. Equity cliff in Q1 so nothing before then. Strong on identity. Package £185k. Don't approach via his employer.", status: "NEEDS_REVIEW", summary: { headline: "Deputy CISO quietly exploring; fractional or Group CISO", capabilities: ["ciso", "cyber security", "identity and access"], sectors: ["insurance", "financial services"], engagementPreferences: ["FRACTIONAL", "PERMANENT"], locationPreferences: ["manchester", "uk"], currentStatus: "Quietly exploring; equity cliff in Q1", suggestedAvailabilityStatus: "QUIETLY_EXPLORING", ratesOrSalary: "£185k package", workingCharacteristics: ["Thoughtful", "Low profile"], constraints: ["Nothing before Q1 vesting", "Do not approach via employer"], strengths: ["Identity programmes"], avoid: [], unresolvedQuestions: ["Would his employer permit a fractional arrangement?", "Rate for fractional work?"], summary: "Quietly exploring; fractional CISO or Group CISO; nothing before Q1." } });
  await conv("marcus", waqas.id, { daysAgo: 15, rawNotes: "Marcus is between engagements and open to conversations. Interested in Dubai — family would move. Interim COO roles or fractional. £1,800/day. Bored by steady state — needs a burning platform.", status: "APPROVED", followUp: 20, tags: ["interim", "dubai"], summary: { headline: "Interim COO open to conversations, Dubai interest", capabilities: ["coo", "operations", "turnaround"], sectors: ["logistics", "retail"], engagementPreferences: ["INTERIM", "FRACTIONAL"], locationPreferences: ["dubai", "uk"], currentStatus: "Between engagements", suggestedAvailabilityStatus: "OPEN_TO_CONVERSATIONS", ratesOrSalary: "£1,800/day", workingCharacteristics: ["Blunt", "Thrives in crisis"], constraints: [], strengths: ["Operations turnaround"], avoid: ["Steady-state roles"], unresolvedQuestions: [], summary: "Open to interim COO or fractional; Dubai possible." } });
  await conv("emma", waqas.id, { daysAgo: 9, type: "IN_PERSON", rawNotes: "Coffee with Emma. Quietly exploring — frustrated by lack of progression. Would move for Head of Reg Change or a step up. £175k now. Only London. Strict confidentiality.", status: "DRAFT" });
  await conv("hannah", waqas.id, { daysAgo: 22, type: "INTRO_CALL", rawNotes: "Intro via Daniel. Hannah leads AI at a Nordic bank. Only the right opportunity — fractional advisory on responsible AI, especially for Gulf institutions. £1,900/day. Won't leave her role for less than a Group role.", status: "NEEDS_REVIEW", summary: { headline: "Head of AI, right-opportunity-only, fractional advisory interest", capabilities: ["ai", "genai", "governance"], sectors: ["banking"], engagementPreferences: ["ADVISORY", "FRACTIONAL"], locationPreferences: ["london", "uae"], currentStatus: "In role; selective", suggestedAvailabilityStatus: "RIGHT_OPPORTUNITY_ONLY", ratesOrSalary: "£1,900/day", workingCharacteristics: [], constraints: ["Only Group-level roles for a permanent move"], strengths: ["Responsible AI governance"], avoid: [], unresolvedQuestions: ["Capacity — how many days a month?"], summary: "Fractional advisory on responsible AI; selective." } });
  await conv("khalid", richard.id, { daysAgo: 30, type: "OPPORTUNITY_DISCUSSION", rawNotes: "Khalid is busy but keen to stay close to Amana. Not looking for anything new until Q2 but happy to be on a bid team if the client is right. AED 5,000/day.", status: "APPROVED", followUp: 45, summary: { headline: "Bid director, not looking until Q2, keep warm", capabilities: ["bid management", "proposal"], sectors: ["government"], engagementPreferences: ["SOW"], locationPreferences: ["dubai"], currentStatus: "Busy until Q2", suggestedAvailabilityStatus: "NOT_LOOKING_KEEP_IN_TOUCH", ratesOrSalary: "AED 5,000/day", workingCharacteristics: [], constraints: ["Not before Q2"], strengths: ["Winning GCC public sector bids"], avoid: [], unresolvedQuestions: [], summary: "Keep warm for Q2 bids." } });
  await conv("fatima", richard.id, { daysAgo: 8, type: "INTRO_CALL", rawNotes: "Fatima available now. GRC for energy and government. AED 4,200/day. Would do UK remote work. Contract or SOW.", status: "APPROVED", followUp: 14, summary: { headline: "Cyber GRC consultant available now", capabilities: ["cyber security", "governance", "risk", "compliance"], sectors: ["energy", "government"], engagementPreferences: ["CONTRACT", "SOW"], locationPreferences: ["abu dhabi", "remote"], currentStatus: "Available now", suggestedAvailabilityStatus: "AVAILABLE_NOW", ratesOrSalary: "AED 4,200/day", workingCharacteristics: [], constraints: [], strengths: ["Regulatory GRC"], avoid: [], unresolvedQuestions: ["Direct evidence of delivery — reference only so far"], summary: "Available now for GRC contract/SOW." } });
  await conv("tom", waqas.id, { daysAgo: 12, rawNotes: "Tom has capacity for one more fractional CFO client from next month. Carve-outs and scale-ups. £1,600/day. Edinburgh-based, travels.", status: "APPROVED", followUp: 30, summary: { headline: "Fractional CFO with capacity from next month", capabilities: ["cfo", "finance transformation", "m&a integration"], sectors: ["technology", "retail"], engagementPreferences: ["FRACTIONAL", "ADVISORY"], locationPreferences: ["edinburgh", "uk"], currentStatus: "Capacity for one more client", suggestedAvailabilityStatus: "FRACTIONAL_AVAILABILITY", ratesOrSalary: "£1,600/day", workingCharacteristics: [], constraints: [], strengths: ["Carve-outs"], avoid: [], unresolvedQuestions: [], summary: "One fractional CFO slot available." } });

  // Scheduled conversations (upcoming)
  await prisma.scheduledConversation.create({ data: { tenantId: founderTenant.id, personId: people["ben"].id, ownerId: waqas.id, provider: "MANUAL", startAt: daysAhead(2), endAt: new Date(daysAhead(2).getTime() + 45 * 60_000), meetingType: "INTRO_CALL", status: "SCHEDULED" } });
  await prisma.scheduledConversation.create({ data: { tenantId: founderTenant.id, personId: people["grace"].id, ownerId: waqas.id, provider: "MANUAL", startAt: daysAhead(4), endAt: new Date(daysAhead(4).getTime() + 30 * 60_000), meetingType: "INTRO_CALL", status: "SCHEDULED" } });
  await prisma.scheduledConversation.create({ data: { tenantId: founderTenant.id, personId: people["james"].id, ownerId: waqas.id, provider: "MANUAL", startAt: daysAhead(6), endAt: new Date(daysAhead(6).getTime() + 30 * 60_000), meetingType: "CATCH_UP", status: "SCHEDULED" } });

  // Relocation profiles
  await prisma.relocationProfile.create({ data: { personId: people["priya"].id, currentLocation: "London, UK", targetLocation: "Abu Dhabi, UAE", targetMoveWindow: "Within 12 months (September school intake)", familyMove: true, schoolGuidanceInterest: true, housingGuidanceInterest: true, relocationAdvisoryInterest: true, employerSponsored: false, advisoryStatus: "DISCOVERY_CALL", notes: "Two children, primary age. Wants British-curriculum schools." } });
  await prisma.relocationProfile.create({ data: { personId: people["sarah"].id, currentLocation: "London, UK", targetLocation: "Dubai, UAE", targetMoveWindow: "6–12 months, client dependent", familyMove: true, relocationAdvisoryInterest: true, employerSponsored: true, advisoryStatus: "INTEREST_CAPTURED", notes: "Would expect the client to sponsor the move." } });
  await prisma.relocationProfile.create({ data: { personId: people["marcus"].id, currentLocation: "Leeds, UK", targetLocation: "Dubai, UAE", targetMoveWindow: "Flexible", familyMove: true, relocationAdvisoryInterest: false, advisoryStatus: "INTEREST_CAPTURED" } });
  await prisma.relocationProfile.create({ data: { personId: people["amira"].id, currentLocation: "Dubai, UAE", targetLocation: "London, UK", targetMoveWindow: "12–18 months", familyMove: false, housingGuidanceInterest: true, relocationAdvisoryInterest: true, employerSponsored: true, advisoryStatus: "PROPOSAL_SENT", notes: "Employer-sponsored package discussed with Amana." } });

  // Opportunities
  const opp1 = await prisma.opportunity.create({ data: { tenantId: founderTenant.id, sourceType: "AMANA", clientName: "Tier-1 UK bank (via Amana)", title: "Stabilise a core banking transformation and challenge the SI", problemStatement: "A £120m core banking replacement is six months late. The client needs someone to take control of the programme, re-baseline the systems integrator and rebuild board confidence.", desiredOutcomes: "Credible re-baselined plan in 60 days; SI contract renegotiated; board reporting restored.", engagementRoute: "SOW", location: "London (hybrid)", duration: "12 months", startDate: daysAhead(30), budget: 1400, currency: "GBP", requiredCapabilities: ["Programme director", "Systems integrator challenge", "Turnaround"], preferredCapabilities: ["PMO", "Regulatory"], sectors: ["Banking"], seniority: "DIRECTOR", status: "SHORTLIST", isAmana: true } });
  const opp2 = await prisma.opportunity.create({ data: { tenantId: founderTenant.id, sourceType: "PARTNER", partnerId: partner.id, clientName: "UK insurer (via Harbour Search)", title: "Group CISO", problemStatement: "Insurer needs a Group CISO after a regulatory finding on identity and access controls. Permanent hire; must be credible with the FCA.", desiredOutcomes: "Remediation plan accepted by regulator; identity programme delivered.", engagementRoute: "PERMANENT", location: "Manchester / London", startDate: daysAhead(90), budget: 190000, currency: "GBP", requiredCapabilities: ["CISO", "Identity and access", "Regulatory"], preferredCapabilities: ["Security architecture"], sectors: ["Insurance"], seniority: "EXECUTIVE", status: "MATCHING" } });
  const opp3 = await prisma.opportunity.create({ data: { tenantId: founderTenant.id, sourceType: "DIRECT_CLIENT", clientName: "Meridian Energy", title: "Fractional operations lead for Gulf expansion", problemStatement: "Meridian is opening a Dubai operation and needs someone two to three days a week to build the operating model and hire the local team.", desiredOutcomes: "Operating model designed; first five hires made; handover to local COO in nine months.", engagementRoute: "FRACTIONAL", location: "Dubai", duration: "9 months", startDate: daysAhead(45), budget: 1700, currency: "GBP", requiredCapabilities: ["Operations", "Target operating model"], preferredCapabilities: ["Turnaround", "Supply chain"], sectors: ["Energy"], seniority: "EXECUTIVE", status: "MATCHING" } });
  const opp4 = await prisma.opportunity.create({ data: { tenantId: founderTenant.id, sourceType: "AMANA", clientName: "Abu Dhabi government entity (via Amana)", title: "Cyber GRC uplift — proposal team", problemStatement: "Amana is bidding for a 6-month GRC uplift. Need a GRC lead and a bid director for the proposal, plus an architecture reviewer.", desiredOutcomes: "Winning proposal submitted in three weeks; team ready to mobilise.", engagementRoute: "SOW", location: "Abu Dhabi", duration: "6 months", startDate: daysAhead(60), budget: 4500, currency: "AED", requiredCapabilities: ["Cyber security", "Governance", "Risk", "Compliance"], preferredCapabilities: ["Bid management", "Enterprise architecture"], sectors: ["Government"], seniority: "MANAGER", status: "QUALIFYING", isAmana: true } });
  const opp5 = await prisma.opportunity.create({ data: { tenantId: founderTenant.id, sourceType: "FOUNDER", clientName: "Private equity portfolio company", title: "Fractional CFO for a carve-out", problemStatement: "Portfolio company being carved out of a larger group needs a fractional CFO to stand up finance, two days a week.", engagementRoute: "FRACTIONAL", location: "Remote / Edinburgh", duration: "6 months", budget: 1600, currency: "GBP", requiredCapabilities: ["CFO", "M&A integration", "Finance transformation"], preferredCapabilities: [], sectors: ["Technology"], seniority: "EXECUTIVE", status: "INTAKE" } });
  await prisma.opportunity.create({ data: { tenantId: founderTenant.id, sourceType: "AMANA", clientName: "Utility (via Amana)", title: "SAP S/4 programme assurance", problemStatement: "Independent assurance of an S/4 programme ahead of go-live decision.", engagementRoute: "ADVISORY", location: "Birmingham", duration: "8 weeks", budget: 1300, currency: "GBP", requiredCapabilities: ["SAP", "ERP", "Programme management"], preferredCapabilities: ["Vendor management"], sectors: ["Utilities"], seniority: "DIRECTOR", status: "CLOSED_WON", isAmana: true } });

  // Matches — generated with the real engine so demo data matches production behaviour
  const allPeople = await prisma.person.findMany({ where: { tenantId: founderTenant.id }, include: { relationships: true, evidence: true, conversations: { where: { approvalStatus: "APPROVED" } } } });
  const matchInputs = allPeople.map((p) => ({
    id: p.id,
    capabilities: p.capabilities,
    sectors: p.sectors,
    seniority: p.seniority,
    engagementPreferences: p.engagementPreferences,
    primaryCity: p.primaryCity,
    primaryCountry: p.primaryCountry,
    targetLocations: p.targetLocations,
    availabilityStatus: p.availabilityStatus,
    availabilityConfirmedAt: p.availabilityConfirmedAt,
    nextCheckDate: p.nextCheckDate,
    rateExpectation: p.rateExpectation,
    salaryExpectation: p.salaryExpectation,
    relationships: p.relationships.map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain, yearsKnown: r.yearsKnown })),
    evidence: p.evidence.map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })),
    approvedConversations: p.conversations.length,
  }));

  const decisions: Partial<Record<string, Partial<Record<string, HumanDecision>>>> = {
    [opp1.id]: { [people["sarah"].id]: "RECOMMEND", [people["ben"].id]: "NEED_MORE_EVIDENCE", [people["james"].id]: "POSSIBLE" },
    [opp2.id]: { [people["daniel"].id]: "POSSIBLE" },
    [opp3.id]: { [people["marcus"].id]: "RECOMMEND" },
  };

  for (const opp of [opp1, opp2, opp3, opp4, opp5]) {
    const results = retrieveMatches(
      { requiredCapabilities: opp.requiredCapabilities, preferredCapabilities: opp.preferredCapabilities, sectors: opp.sectors, seniority: opp.seniority, engagementRoute: opp.engagementRoute, location: opp.location, budget: opp.budget ? Number(opp.budget) : null },
      matchInputs,
      8,
    );
    for (const m of results) {
      const decision: HumanDecision = decisions[opp.id]?.[m.personId] ?? "UNDECIDED";
      await prisma.match.create({
        data: {
          opportunityId: opp.id,
          personId: m.personId,
          fitScore: m.fitScore,
          fitExplanation: m.fitExplanation,
          evidenceStrength: m.evidenceStrength,
          relationshipStrength: m.relationshipStrength,
          availabilityFit: m.availabilityFit,
          commercialFit: m.commercialFit,
          uncertainty: m.uncertainty,
          humanDecision: decision,
          approvedById: decision === "UNDECIDED" ? null : waqas.id,
          humanNotes: decision === "RECOMMEND" ? "Seen deliver exactly this. Happy to stand behind." : decision === "NEED_MORE_EVIDENCE" ? "Referral only so far — need a conversation and a reference." : null,
        },
      });
    }
  }

  // Introductions
  await prisma.introduction.create({ data: { tenantId: founderTenant.id, opportunityId: opp1.id, personId: people["sarah"].id, requestedById: richard.id, approvedById: waqas.id, consentStatus: "GRANTED", status: "INTRODUCED", introducedAt: daysAgo(2), route: "SOW", commercialModel: "AMANA_SOW", commercialValue: 300000, currency: "GBP", notes: "Introduced to Amana engagement lead; client meeting booked." } });
  await prisma.introduction.create({ data: { tenantId: founderTenant.id, opportunityId: opp2.id, personId: people["daniel"].id, requestedById: partnerUser.id, consentStatus: "REQUESTED", status: "REQUESTED", route: "PERMANENT", recruitmentPartnerId: partner.id, commercialModel: "SUCCESS_SHARE", commercialSharePct: 15, commercialValue: 190000, currency: "GBP", notes: "Partner requested identity reveal. Waiting on Daniel's consent — do not reveal before Q1 per his constraint." } });
  await prisma.introduction.create({ data: { tenantId: founderTenant.id, opportunityId: opp3.id, personId: people["marcus"].id, requestedById: waqas.id, approvedById: waqas.id, consentStatus: "GRANTED", status: "APPROVED", route: "FRACTIONAL", commercialModel: "INTRODUCTION_FEE", commercialValue: 15000, currency: "GBP" } });

  // Amana team shortlist for the GRC bid
  await prisma.teamShortlistMember.createMany({
    data: [
      { opportunityId: opp4.id, personId: people["fatima"].id, roleOnTeam: "GRC lead" },
      { opportunityId: opp4.id, personId: people["khalid"].id, roleOnTeam: "Bid director", notes: "Keep-warm status; check Q2 capacity" },
      { opportunityId: opp4.id, personId: people["layla"].id, roleOnTeam: "Architecture reviewer (advisory)" },
    ],
  });

  // Partner requirements
  await prisma.partnerRequirement.create({ data: { partnerId: partner.id, title: "Group CISO — UK insurer", description: "Permanent Group CISO following a regulatory finding on identity and access.", engagementRoute: "PERMANENT", location: "Manchester / London", requiredCapabilities: ["CISO", "Identity and access", "Regulatory"], seniority: "EXECUTIVE", budget: "£180–200k", status: "INTRO_REQUESTED", linkedOpportunityId: opp2.id } });
  await prisma.partnerRequirement.create({ data: { partnerId: partner.id, title: "Head of Regulatory Change — bank", description: "Permanent hire for a UK bank; must have run a large regulatory programme.", engagementRoute: "PERMANENT", location: "London", requiredCapabilities: ["Regulatory", "Programme management", "Change management"], seniority: "DIRECTOR", budget: "£170k", status: "SUBMITTED" } });

  // Saved views
  await prisma.savedView.createMany({
    data: [
      { tenantId: founderTenant.id, userId: waqas.id, name: "Available in the Gulf", page: "network", query: { location: "UAE", availableSoon: true } },
      { tenantId: founderTenant.id, userId: waqas.id, name: "Worked with, needs refresh", page: "network", query: { workedWith: true, freshness: "stale" } },
      { tenantId: founderTenant.id, userId: richard.id, name: "Amana SOW bench", page: "network", query: { amanaBench: true } },
    ],
  });

  // Audit trail
  await prisma.auditLog.createMany({
    data: [
      { tenantId: founderTenant.id, actorId: waqas.id, action: "auth.login", entityType: "User", entityId: waqas.id, createdAt: daysAgo(0) },
      { tenantId: founderTenant.id, actorId: waqas.id, action: "summary.approve", entityType: "Conversation", entityId: null, metadata: { person: "Priya Natarajan" }, createdAt: daysAgo(3) },
      { tenantId: founderTenant.id, actorId: waqas.id, action: "introduction.approve", entityType: "Introduction", entityId: null, metadata: { person: "Sarah Okonkwo", opportunity: opp1.title }, createdAt: daysAgo(2) },
      { tenantId: founderTenant.id, actorId: richard.id, action: "team.add", entityType: "Opportunity", entityId: opp4.id, metadata: { person: "Fatima Al Rashid" }, createdAt: daysAgo(1) },
      { tenantId: partnerTenant.id, actorId: partnerUser.id, action: "partner.requirement", entityType: "PartnerRequirement", entityId: null, metadata: { title: "Group CISO — UK insurer" }, createdAt: daysAgo(5) },
      { tenantId: founderTenant.id, actorId: waqas.id, action: "integration.connect", entityType: "SchedulingConnection", entityId: null, metadata: { provider: "MANUAL" }, createdAt: daysAgo(30) },
      { tenantId: clientTenant.id, actorId: clientUser.id, action: "auth.login", entityType: "User", entityId: clientUser.id, createdAt: daysAgo(7) },
    ],
  });

  console.log(`Seeded ${PEOPLE.length} people, 6 opportunities, 3 tenants.`);
  console.log(`Demo password for all users: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
