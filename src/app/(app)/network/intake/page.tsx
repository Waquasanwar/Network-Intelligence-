import Link from "next/link";
import { requireInternal } from "@/server/session";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { AiIntakeChat } from "@/components/domain/ai-intake-chat";
import { List } from "lucide-react";

export const metadata = { title: "AI intake" };

export default async function IntakePage() {
  await requireInternal();
  return (
    <div className="max-w-[760px] mx-auto">
      <PageHeader
        title="AI intake"
        description="Have a short conversation instead of filling in a form. The assistant asks a few questions and structures the answers into a profile — which a human reviews before anything goes live."
        actions={<Link href="/network"><Button variant="secondary"><List className="h-3.5 w-3.5" /> Network</Button></Link>}
      />
      <AiIntakeChat />
    </div>
  );
}
