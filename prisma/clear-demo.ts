/**
 * Remove the seeded demo network so you can start with your own contacts.
 * Keeps tenants, users, partners and integrations. Run: npm run db:clear-demo
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const [intro, match, team, conv, sched, ev, rel, reloc, people, opps, reqs] = await prisma.$transaction([
    prisma.introduction.deleteMany(),
    prisma.match.deleteMany(),
    prisma.teamShortlistMember.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.scheduledConversation.deleteMany(),
    prisma.evidence.deleteMany(),
    prisma.relationship.deleteMany(),
    prisma.relocationProfile.deleteMany(),
    prisma.person.deleteMany(),
    prisma.opportunity.deleteMany(),
    prisma.partnerRequirement.deleteMany(),
  ]);
  await prisma.auditLog.deleteMany({ where: { entityType: { in: ["Person", "Conversation", "Opportunity", "Match", "Introduction", "Relationship", "Evidence", "RelocationProfile", "PartnerRequirement", "ScheduledConversation"] } } });
  console.log(`Cleared ${people.count} people, ${rel.count} relationships, ${ev.count} evidence, ${conv.count} conversations, ${sched.count} scheduled, ${opps.count} opportunities, ${match.count} matches, ${intro.count} introductions, ${team.count} team members, ${reloc.count} relocation profiles, ${reqs.count} partner requirements.`);
  console.log("Users, tenants and partner accounts are kept. Sign in and use Import contacts.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
