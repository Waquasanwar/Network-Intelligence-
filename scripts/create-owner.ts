/**
 * Create the first real platform-owner account, with no demo data.
 *
 * The seed (`npm run db:seed`) is for the demo database only and must never run against production.
 * Use this instead on a fresh production database, then invite everyone else from inside the app.
 *
 *   OWNER_EMAIL=you@firm.com OWNER_NAME="Your Name" OWNER_PASSWORD='a-strong-passphrase' \
 *   TENANT_NAME="Your Network" npm run db:create-owner
 *
 * It refuses to run if the email already exists, and requires a password of at least 12 characters.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "owner";
}

async function main() {
  const email = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.OWNER_NAME ?? "").trim();
  const password = process.env.OWNER_PASSWORD ?? "";
  const tenantName = (process.env.TENANT_NAME ?? "").trim();
  const tenantSlug = slugify(process.env.TENANT_SLUG ?? tenantName);

  const problems: string[] = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("OWNER_EMAIL must be a valid email");
  if (!name) problems.push("OWNER_NAME is required");
  if (password.length < 12) problems.push("OWNER_PASSWORD must be at least 12 characters");
  if (!tenantName) problems.push("TENANT_NAME is required");
  if (problems.length) {
    console.error("Cannot create owner:\n  - " + problems.join("\n  - "));
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`A user with ${email} already exists. Refusing to overwrite it.`);
    process.exit(1);
  }

  const tenant =
    (await prisma.tenant.findFirst({ where: { type: "PLATFORM_OWNER" } })) ??
    (await prisma.tenant.create({ data: { slug: tenantSlug, name: tenantName, type: "PLATFORM_OWNER", brandName: tenantName } }));

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: { tenantId: tenant.id, email, name, role: "OWNER", passwordHash },
  });
  await prisma.auditLog.create({
    data: { tenantId: tenant.id, actorId: user.id, action: "user.role_change", entityType: "User", entityId: user.id, metadata: { created: "owner", via: "create-owner script" } },
  });

  console.log(`Owner created: ${name} <${email}> in tenant "${tenant.name}".`);
  console.log("Sign in, then set up MFA under Settings → Security before inviting anyone else.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
