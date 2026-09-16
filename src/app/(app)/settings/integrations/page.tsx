import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { listSchedulingProviders } from "@/lib/scheduling";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { connectIntegration, disconnectIntegration } from "@/server/actions/settings";
import { DateText } from "@/components/domain/date";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const user = await requireInternal();
  const connections = await prisma.schedulingConnection.findMany({ where: { userId: user.id } });
  const providers = listSchedulingProviders();
  const aiProvider = (process.env.AI_PROVIDER || "heuristic").toLowerCase();

  return (
    <>
      <PageHeader title="Integrations" description="Conversations are scheduled from the platform. Each provider requests the least privilege it needs, and you can see exactly what that is before connecting." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((p) => {
          const c = connections.find((x) => x.provider === p.kind && !x.revokedAt);
          const live = p.isConfigured();
          return (
            <Card key={p.kind}>
              <CardHeader title={p.displayName} action={c ? <Badge tone="teal">connected</Badge> : <Badge>not connected</Badge>} description={p.kind === "MANUAL" ? "Always available. Records the conversation without touching a calendar." : p.kind === "MICROSOFT_GRAPH" ? "Creates Outlook events with a Teams link; updates and cancels from the platform." : "Booking links, invitee mapping via webhook, cancellations."} />
              <CardBody>
                <div className="text-[11px] uppercase text-ink-faint mb-1">Permissions requested</div>
                {p.requestedScopes.length ? <ul className="text-xs space-y-0.5 mb-3">{p.requestedScopes.map((s) => <li key={s} className="font-mono">{s}</li>)}</ul> : <div className="text-xs text-ink-muted mb-3">None</div>}
                {!live && p.kind !== "MANUAL" ? <div className="text-[11px] text-amber mb-3">Provider credentials are not configured on this deployment. Connecting records the intent; events will be stored as proposed slots until credentials are added.</div> : null}
                {c ? <div className="text-[11px] text-ink-faint mb-3">Connected <DateText date={c.connectedAt} relative /></div> : null}
                <form action={c ? disconnectIntegration : connectIntegration}>
                  <input type="hidden" name="provider" value={p.kind} />
                  <SubmitButton variant={c ? "secondary" : "primary"} pendingText="…">{c ? "Disconnect" : "Connect"}</SubmitButton>
                </form>
              </CardBody>
            </Card>
          );
        })}
      </div>
      <Card className="mt-4">
        <CardHeader title="AI provider" description="Provider abstraction. Tenant data is never used to train shared models. Transcripts are treated as untrusted input." />
        <CardBody>
          <div className="text-xs">Active provider: <span className="font-mono">{aiProvider}</span>{aiProvider === "heuristic" ? <span className="text-ink-faint"> — runs locally with no external calls. Set AI_PROVIDER=anthropic and an API key to use a hosted model.</span> : null}</div>
        </CardBody>
      </Card>
    </>
  );
}
