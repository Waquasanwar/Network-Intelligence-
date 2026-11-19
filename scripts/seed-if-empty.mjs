// Loads the demo data into an empty database, and does nothing to one that already has users.
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

const prisma = new PrismaClient();
const users = await prisma.user.count();
await prisma.$disconnect();
if (users > 0) {
  console.log(`seed: skipped, the database already has ${users} user(s)`);
} else {
  console.log("seed: empty database, loading demo data");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}
