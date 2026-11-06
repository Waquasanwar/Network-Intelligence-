import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InviteLinkButton } from "@/components/domain/invite-link-button";

export const metadata = { title: "Invite" };

export default async function InvitePage() {
  const user = await requireInternal();
  const members = await prisma.person.count({ where: { tenantId: user.tenantId, memberSince: { not: null } } });

  return (
    <div className="max-w-[640px] mx-auto">
      <PageHeader title="Invite to the network" description="Share a link and someone can register themselves and start their screening. You review everything before anyone goes live — the network stays invitation-only." />
      <Card>
        <CardHeader title="Your invite link" description="Anyone with this link can register into your network. Send it to people you would want in." />
        <CardBody className="pt-1">
          <InviteLinkButton />
          <p className="text-[12px] text-ink-faint mt-4">{members} member{members === 1 ? "" : "s"} so far. Once members are screened and live, they can invite people too — from their own profile.</p>
        </CardBody>
      </Card>
    </div>
  );
}
