import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/server/session";
import { isInternal, isMember } from "@/lib/authz";
import { canShowPhoto } from "@/lib/privacy";

/**
 * A member's photo, for people inside the network only: the team and other members of the same
 * network, and only while the member agrees to show it. Agencies and clients never get one here.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user || !(isInternal(user) || isMember(user))) return new NextResponse(null, { status: 404 });
  const { id } = await params;
  const p = await prisma.person.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, photoUrl: true, privacy: true } });
  if (!p || !canShowPhoto(p, "internal")) return new NextResponse(null, { status: 404 });
  const url = p.photoUrl!;
  if (!url.startsWith("data:image/jpeg;base64,")) return NextResponse.redirect(url, 302);
  const bytes = Buffer.from(url.slice("data:image/jpeg;base64,".length), "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(bytes.length),
      // Private to this signed-in browser; the ?v= fingerprint changes when the photo does.
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
