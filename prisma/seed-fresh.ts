/**
 * Fresh-start seed: a clean slate to begin using the platform for real.
 *
 * Creates the platform owner, ONE sample client and ONE sample agency (each with its portal wired
 * up), and three sample experts in the network so you can immediately send a screening request and
 * try the matching flow. No opportunities, briefs, conversations or extra tenants — you build those.
 *
 * Run with:  npm run db:fresh
 *
 * This WIPES ALL DATA in the target database (a data-only truncate; the schema and migrations are
 * kept) and then seeds the minimal set below. It refuses to run against NODE_ENV=production unless
 * ALLOW_FRESH_IN_PROD=yes is set, so it can't wipe a live database by accident.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Password123!";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function wipe() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_FRESH_IN_PROD !== "yes") {
    console.error("Refusing to wipe a production database. Set ALLOW_FRESH_IN_PROD=yes only if you really mean it.");
    process.exit(1);
  }
  await wipe();
  const passwordHash = await hash(DEMO_PASSWORD, 10);

  // --- Platform owner ---
  const ownerTenant = await prisma.tenant.create({ data: { slug: "amana", name: "Amana Network", type: "PLATFORM_OWNER", brandName: "Amana Network" } });
  const owner = await prisma.user.create({ data: { tenantId: ownerTenant.id, email: "waqas@networkintelligence.local", name: "Waqas Anwar", role: "OWNER", passwordHash, lastLoginAt: new Date() } });
  await prisma.schedulingConnection.create({ data: { userId: owner.id, provider: "MANUAL", scopes: [] } });

  // --- One sample client (direct) + its portal ---
  const clientTenant = await prisma.tenant.create({ data: { slug: "meridian-energy", name: "Meridian Energy", type: "DIRECT_CLIENT", brandName: "Meridian Energy" } });
  await prisma.user.create({ data: { tenantId: clientTenant.id, email: "client@meridian.local", name: "Nadia Stone", role: "CLIENT", passwordHash } });
  await prisma.commercialAccount.create({ data: { tenantId: ownerTenant.id, name: "Meridian Energy", kind: "CLIENT", status: "ACTIVE", contactName: "Nadia Stone", contactEmail: "client@meridian.local", currency: "GBP", portalTenantId: clientTenant.id, portalEnabled: true, notes: "Sample direct client." } });

  // --- One sample agency (recruitment partner) + its portal ---
  const agencyTenant = await prisma.tenant.create({ data: { slug: "harbour-search", name: "Harbour Search", type: "RECRUITMENT_PARTNER", brandName: "Harbour Search" } });
  await prisma.user.create({ data: { tenantId: agencyTenant.id, email: "partner@harboursearch.local", name: "Jo Harbour", role: "PARTNER", passwordHash } });
  const partner = await prisma.partner.create({ data: { tenantId: agencyTenant.id, name: "Harbour Search", contactName: "Jo Harbour", contactEmail: "partner@harboursearch.local", subscriptionStatus: "ACTIVE", subscriptionTier: "Standard", commercialModel: "SUCCESS_SHARE", commercialSharePct: 15, monthlyFee: 1500, currency: "GBP", licensedForPermanent: true, notes: "Sample agency." } });
  await prisma.commercialAccount.create({ data: { tenantId: ownerTenant.id, name: "Harbour Search", kind: "AGENCY", status: "ACTIVE", contactName: "Jo Harbour", contactEmail: "partner@harboursearch.local", currency: "GBP", monthlyFee: 1500, partnerId: partner.id, portalTenantId: agencyTenant.id, portalEnabled: true, notes: "Sample agency." } });

  // --- Three sample experts in the owner's network (so you can send a screening request) ---
  const samples = [
    { firstName: "Priya", lastName: "Natarajan", email: "priya@example.com", headline: "Change and target operating model lead", currentRole: "Change Director", currentCompany: "Independent", city: "London", country: "UK", capabilities: ["Change management", "Target operating model", "Transformation"], sectors: ["Banking"], seniority: "DIRECTOR", routes: ["CONTRACT", "SOW"] },
    { firstName: "Omar", lastName: "Haddad", email: "omar@example.com", headline: "Business analyst turned product owner, retail banking", currentRole: "Product Owner", currentCompany: "Independent", city: "Dubai", country: "UAE", capabilities: ["Business analysis", "Product ownership", "Retail banking"], sectors: ["Banking"], seniority: "MANAGER", routes: ["PERMANENT", "CONTRACT"] },
    { firstName: "Sarah", lastName: "Okonkwo", email: "sarah@example.com", headline: "Programme director who stabilises troubled transformations", currentRole: "Programme Director", currentCompany: "Independent", city: "London", country: "UK", capabilities: ["Programme director", "Transformation", "Turnaround"], sectors: ["Banking", "Insurance"], seniority: "DIRECTOR", routes: ["INTERIM", "SOW"] },
  ];
  for (const s of samples) {
    const person = await prisma.person.create({
      data: {
        tenantId: ownerTenant.id, firstName: s.firstName, lastName: s.lastName, email: s.email, headline: s.headline,
        currentRole: s.currentRole, currentCompany: s.currentCompany, primaryCity: s.city, primaryCountry: s.country,
        targetLocations: [], capabilities: s.capabilities, sectors: s.sectors, seniority: s.seniority as never,
        engagementPreferences: s.routes as never, availabilityStatus: "OPEN_TO_CONVERSATIONS", availabilityConfidence: 50,
        relocationInterest: false, amanaBench: false, usedByAmana: false, nextAction: "Book first conversation",
      },
    });
    await prisma.relationship.create({ data: { personId: person.id, networkOwnerId: owner.id, sourceType: "WORKED_TOGETHER", relationshipType: "WORKED_WITH", workedTogether: true, lastContactDate: daysAgo(20) } });
  }

  console.log("Fresh start seeded:");
  console.log("  • Owner   waqas@networkintelligence.local");
  console.log("  • Client  client@meridian.local  (Meridian Energy)");
  console.log("  • Agency  partner@harboursearch.local  (Harbour Search)");
  console.log("  • 3 sample experts in the network, ready to screen");
  console.log(`  • Password for all: ${DEMO_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
