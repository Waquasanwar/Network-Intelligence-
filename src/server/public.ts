import "server-only";
import { prisma } from "@/lib/db";

/**
 * The network the public page speaks for. One deployment serves one network to the outside world:
 * the tenant named by PUBLIC_NETWORK_SLUG, or failing that the oldest tenant that runs a network
 * (never a client's or an agency's). The page shows its name and nothing else about it.
 */
const RUNS_A_NETWORK = ["PLATFORM_OWNER", "CONSULTANCY"] as const;

export async function publicNetwork(): Promise<{ id: string; name: string } | null> {
  const slug = process.env.PUBLIC_NETWORK_SLUG?.trim();
  const select = { id: true, name: true, brandName: true, type: true } as const;
  const t = slug
    ? await prisma.tenant.findUnique({ where: { slug }, select })
    : await prisma.tenant.findFirst({ where: { type: { in: [...RUNS_A_NETWORK] } }, orderBy: [{ type: "asc" }, { createdAt: "asc" }], select });
  if (!t || !(RUNS_A_NETWORK as readonly string[]).includes(t.type)) return null;
  return { id: t.id, name: t.brandName ?? t.name };
}

/** How many unanswered public requests one network will hold. Past this, new ones are dropped. */
export const MAX_WAITING = 500;
