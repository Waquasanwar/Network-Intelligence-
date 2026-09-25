import { requireInternal } from "@/server/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { saveVoiceSettings } from "@/server/actions/members";
import { loadVoiceSettings } from "@/server/queries";
import { PROVIDER_LABELS, VOICE_MODELS } from "@/lib/voice-config";
import { SCREENING_SCRIPT, SCREENING_MINUTES } from "@/lib/screening";
import { Lock, MicVocal } from "lucide-react";

export const metadata = { title: "The screening conversation" };

export default async function ScreeningSettingsPage() {
  const user = await requireInternal();
  const { settings, keyConfigured } = await loadVoiceSettings(user.tenantId);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="The screening conversation"
        description={`A real ${SCREENING_MINUTES}-minute conversation in ${SCREENING_SCRIPT.length} parts. The questions are read aloud, the answers are captured as text, and the working-style attributes are read out of what the person actually said rather than asked for as a score.`}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Voice" description="What the person hears. The natural voice is billed to your own ElevenLabs account." action={keyConfigured ? <Badge tone="teal" filled>key configured</Badge> : <Badge tone="amber" filled>no key on this platform</Badge>} />
            <CardBody>
              <form action={saveVoiceSettings} className="space-y-4">
                <Field label="Provider" hint={keyConfigured ? undefined : "Set ELEVENLABS_API_KEY in the server environment to enable the natural voice. Until then the device voice is used."}>
                  <Select name="provider" defaultValue={settings.provider}>
                    {Object.entries(PROVIDER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Voice id" hint="From your own ElevenLabs voice library — the voice is yours, not ours"><Input name="voiceId" defaultValue={settings.voiceId} placeholder="e.g. 9BWtsMINqrJLrRacOk9x" /></Field>
                  <Field label="Model" ><Select name="modelId" defaultValue={settings.modelId}>{VOICE_MODELS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                  <Field label="Conversational agent id" hint="Optional. A two-way agent instead of read-aloud."><Input name="agentId" defaultValue={settings.agentId ?? ""} placeholder="agent_…" /></Field>
                  <Field label="Speed"><Input name="speed" type="number" step="0.05" min={0.5} max={1.5} defaultValue={settings.speed} /></Field>
                  <Field label="Stability" hint="Lower is more expressive, higher is more even"><Input name="stability" type="number" step="0.05" min={0} max={1} defaultValue={settings.stability} /></Field>
                  <Field label="Similarity"><Input name="similarity" type="number" step="0.05" min={0} max={1} defaultValue={settings.similarity} /></Field>
                </div>
                <Checkbox name="redactBeforeSpeaking" label="Keep names, employers and exact numbers out of anything sent to the voice vendor" defaultChecked={settings.redactBeforeSpeaking} />
                <div className="flex justify-end"><SubmitButton pendingText="Saving…">Save voice</SubmitButton></div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="The script" description="Every part maps to something a client asks us. Reorder or edit it per tenant." />
            <CardBody className="pt-0">
              <ul className="divide-y divide-line">
                {SCREENING_SCRIPT.map((s) => (
                  <li key={s.key} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <b className="text-[13px] font-semibold">{s.title}</b>
                      <small className="text-[11px] uppercase tracking-[0.06em] text-ink-faint">{s.minutes} min · {s.questions.length} questions</small>
                    </div>
                    <p className="text-[12.5px] text-ink-muted mt-0.5">{s.intent}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="What leaves this platform" description="Short answer: almost nothing." />
            <CardBody className="pt-0 text-[12.5px] space-y-2.5">
              {[
                [MicVocal, "The person's voice never leaves their device. Speech is turned into text in their own browser; no audio is uploaded or stored."],
                [Lock, "The ElevenLabs key lives only in the server environment. The page asks our own endpoint for audio, so the key is never in the browser and never in the artifact."],
                [Lock, "Only our questions are sent to the voice vendor — never the answers. With redaction on, names, employers and exact figures are stripped even from those."],
                [Lock, "Answers, the transcript and the summary stay in your tenant's database, visible to you and your team. A client or agency never sees them; they see an anonymised card."],
                [Lock, "Nothing reaches a profile until a person has read and approved it, and every sensitive action is written to the audit log."],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof Lock;
                return <div key={i} className="flex gap-2.5"><I className="h-3.5 w-3.5 mt-0.5 flex-none text-teal" /><span className="text-ink-muted">{text as string}</span></div>;
              })}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="If they would rather talk to a person" />
            <CardBody className="pt-0 text-[12.5px] text-ink-muted">
              The conversation ends by offering a real call. When someone accepts, they appear on your alerts and in the joining queue with “asked for a call”, and nothing else happens until you have spoken.
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
