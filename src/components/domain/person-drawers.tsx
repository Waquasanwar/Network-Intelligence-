import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateAvailability, updatePerson, addRelationship, addEvidence } from "@/server/actions/people";
import { scheduleConversation, captureConversation } from "@/server/actions/conversations";
import { upsertRelocation } from "@/server/actions/relocation";
import { AVAILABILITY_LABELS, ROUTE_LABELS, SENIORITY_LABELS, SOURCE_LABELS, RELATIONSHIP_LABELS, EVIDENCE_LABELS, CONVERSATION_PROMPTS, ADVISORY_LABELS } from "@/lib/labels";
import type { Person, RelocationProfile, SchedulingProviderKind } from "@prisma/client";
import { fullName } from "@/lib/utils";
import { CalendarPlus, FileText, Pencil, PlusCircle, Sparkles } from "lucide-react";

export function AvailabilityDrawer({ person }: { person: Person }) {
  return (
    <Drawer trigger={<Button variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Update status</Button>} title="Update availability" description="Status is a spectrum, and it is only as good as the last time it was confirmed.">
      <form action={updateAvailability} className="space-y-4">
        <input type="hidden" name="personId" value={person.id} />
        <Field label="Status" required>
          <Select name="availabilityStatus" defaultValue={person.availabilityStatus}>{Object.entries(AVAILABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </Field>
        <Field label="Available from / unavailable until"><Input type="date" name="availabilityDate" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source"><Select name="availabilitySource" defaultValue="conversation"><option value="conversation">Conversation</option><option value="message">Message</option><option value="third-party">Third party</option><option value="inferred">Inferred</option></Select></Field>
          <Field label="Confidence (0–100)"><Input type="number" name="availabilityConfidence" min={0} max={100} defaultValue={80} /></Field>
        </div>
        <div className="flex justify-end"><SubmitButton>Confirm status</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function EditProfileDrawer({ person }: { person: Person }) {
  const toDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  return (
    <Drawer width="lg" trigger={<Button variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit profile</Button>} title={`Edit ${fullName(person)}`} description="Structured fields. Conversations refine these over time.">
      <form action={updatePerson} className="space-y-4">
        <input type="hidden" name="personId" value={person.id} />
        <Field label="Headline"><Input name="headline" defaultValue={person.headline ?? ""} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current company"><Input name="currentCompany" defaultValue={person.currentCompany ?? ""} /></Field>
          <Field label="Current role"><Input name="currentRole" defaultValue={person.currentRole ?? ""} /></Field>
          <Field label="City"><Input name="primaryCity" defaultValue={person.primaryCity ?? ""} /></Field>
          <Field label="Country"><Input name="primaryCountry" defaultValue={person.primaryCountry ?? ""} /></Field>
        </div>
        <Field label="Target locations" hint="Comma separated"><Input name="targetLocations" defaultValue={person.targetLocations.join(", ")} /></Field>
        <Field label="Capabilities" hint="Comma separated"><Textarea name="capabilities" defaultValue={person.capabilities.join(", ")} /></Field>
        <Field label="Sectors" hint="Comma separated"><Input name="sectors" defaultValue={person.sectors.join(", ")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seniority"><Select name="seniority" defaultValue={person.seniority ?? ""}><option value="">—</option>{Object.entries(SENIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Notice period"><Input name="noticePeriod" defaultValue={person.noticePeriod ?? ""} /></Field>
          <Field label="Rate expectation"><Input name="rateExpectation" defaultValue={person.rateExpectation ?? ""} placeholder="£1,200/day" /></Field>
          <Field label="Salary expectation"><Input name="salaryExpectation" defaultValue={person.salaryExpectation ?? ""} placeholder="£150k" /></Field>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted mb-1">Engagement preferences</div>
          <div className="flex flex-wrap gap-3">{Object.entries(ROUTE_LABELS).map(([k, v]) => <Checkbox key={k} name="engagementPreferences" value={k} label={v} defaultChecked={person.engagementPreferences.includes(k as never)} />)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Next action"><Input name="nextAction" defaultValue={person.nextAction ?? ""} /></Field>
          <Field label="By"><Input type="date" name="nextActionDate" defaultValue={toDate(person.nextActionDate)} /></Field>
        </div>
        <div className="flex gap-4">
          <Checkbox name="amanaBench" label="Amana trusted bench" defaultChecked={person.amanaBench} />
          <Checkbox name="relocationInterest" label="Relocation interest" defaultChecked={person.relocationInterest} />
        </div>
        <div className="flex justify-end"><SubmitButton>Save profile</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function AddRelationshipDrawer({ personId, people }: { personId: string; people: { id: string; firstName: string; lastName: string }[] }) {
  return (
    <Drawer trigger={<Button variant="secondary" size="sm"><PlusCircle className="h-3.5 w-3.5" /> Add relationship</Button>} title="Record a relationship" description="Who knows them, how, and would they work with them again.">
      <form action={addRelationship} className="space-y-4">
        <input type="hidden" name="personId" value={personId} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source" required><Select name="sourceType" defaultValue="PERSONAL_NETWORK">{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Type" required><Select name="relationshipType" defaultValue="DIRECT">{Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <Field label="Introduced by"><Select name="introducedById" defaultValue=""><option value="">—</option>{people.filter((p) => p.id !== personId).map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</Select></Field>
        <Checkbox name="workedTogether" label="Worked together directly" />
        <Field label="Context"><Input name="workedTogetherContext" placeholder="Which programme, when, in what capacity" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Years known"><Input type="number" name="yearsKnown" min={0} /></Field>
          <Field label="Would work together again?"><Select name="wouldWorkTogetherAgain" defaultValue=""><option value="">Not asked</option><option value="yes">Yes</option><option value="no">No</option></Select></Field>
        </div>
        <Field label="Private notes" hint="Never leaves this tenant."><Textarea name="relationshipNotes" /></Field>
        <div className="flex justify-end"><SubmitButton>Save relationship</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function AddEvidenceDrawer({ personId }: { personId: string }) {
  return (
    <Drawer trigger={<Button variant="secondary" size="sm"><PlusCircle className="h-3.5 w-3.5" /> Add evidence</Button>} title="Record observed evidence" description="What has someone in the trusted network directly seen this person deliver?">
      <form action={addEvidence} className="space-y-4">
        <input type="hidden" name="personId" value={personId} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required><Select name="evidenceType" defaultValue="DELIVERY_OBSERVED">{Object.entries(EVIDENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Date observed"><Input type="date" name="dateObserved" /></Field>
        </div>
        <Field label="Context" required hint="Capability and setting, e.g. 'Programme recovery, banking'"><Input name="context" required /></Field>
        <Field label="What you saw" required><Textarea name="description" required placeholder="Specific, observable, outcome-focused." /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Confidence (0–100)"><Input type="number" name="confidence" min={0} max={100} defaultValue={70} /></Field>
          <Field label="Visibility"><Select name="visibility" defaultValue="TENANT"><option value="PRIVATE">Private (me only)</option><option value="TENANT">Internal team</option><option value="PARTNER_SAFE">Shareable after identity reveal</option></Select></Field>
        </div>
        <div className="flex justify-end"><SubmitButton>Save evidence</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function ScheduleDrawer({ personId, connections }: { personId: string; connections: SchedulingProviderKind[] }) {
  const providers: { value: SchedulingProviderKind; label: string }[] = [
    { value: "MANUAL", label: "Manual — call or in person" },
    { value: "MICROSOFT_GRAPH", label: connections.includes("MICROSOFT_GRAPH") ? "Outlook / Teams" : "Outlook / Teams (not connected)" },
    { value: "CALENDLY", label: connections.includes("CALENDLY") ? "Calendly" : "Calendly (not connected)" },
  ];
  const defaultStart = new Date(Date.now() + 2 * 86_400_000);
  defaultStart.setHours(10, 0, 0, 0);
  return (
    <Drawer trigger={<Button size="sm"><CalendarPlus className="h-3.5 w-3.5" /> Book conversation</Button>} title="Book a conversation" description="Outlook, Calendly or a manual slot.">
      <form action={scheduleConversation} className="space-y-4">
        <input type="hidden" name="personId" value={personId} />
        <Field label="Provider"><Select name="provider" defaultValue={connections.includes("MICROSOFT_GRAPH") ? "MICROSOFT_GRAPH" : "MANUAL"}>{providers.map((p) => <option key={p.value} value={p.value} disabled={p.value !== "MANUAL" && !connections.includes(p.value)}>{p.label}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" required><Input type="datetime-local" name="startAt" required defaultValue={defaultStart.toISOString().slice(0, 16)} /></Field>
          <Field label="Duration (min)"><Input type="number" name="durationMinutes" defaultValue={45} min={15} max={240} /></Field>
        </div>
        <Field label="Type"><Select name="meetingType" defaultValue="INTRO_CALL"><option value="INTRO_CALL">Intro call</option><option value="CATCH_UP">Catch-up</option><option value="OPPORTUNITY_DISCUSSION">Opportunity discussion</option><option value="REFERENCE">Reference</option><option value="IN_PERSON">In person</option></Select></Field>
        <div className="flex justify-end"><SubmitButton pendingText="Booking…">Book</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function CaptureConversationDrawer({ personId, scheduledEventId, label = "Capture conversation" }: { personId: string; scheduledEventId?: string; label?: string }) {
  return (
    <Drawer width="lg" trigger={<Button size="sm" variant="secondary"><FileText className="h-3.5 w-3.5" /> {label}</Button>} title="Capture a conversation" description="Paste notes or a transcript. AI structures it; you approve it before anything changes.">
      <form action={captureConversation} className="space-y-4">
        <input type="hidden" name="personId" value={personId} />
        {scheduledEventId ? <input type="hidden" name="scheduledEventId" value={scheduledEventId} /> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="datetime-local" name="date" defaultValue={new Date().toISOString().slice(0, 16)} /></Field>
          <Field label="Type"><Select name="type" defaultValue="CATCH_UP"><option value="INTRO_CALL">Intro call</option><option value="CATCH_UP">Catch-up</option><option value="OPPORTUNITY_DISCUSSION">Opportunity discussion</option><option value="REFERENCE">Reference</option><option value="IN_PERSON">In person</option><option value="MESSAGE_THREAD">Message thread</option></Select></Field>
        </div>
        <details className="rounded-md border border-line bg-surface-muted px-3 py-2">
          <summary className="text-xs font-medium text-ink cursor-pointer">Natural conversation prompts</summary>
          <ul className="mt-2 space-y-1 text-xs text-ink-muted list-disc pl-4">{CONVERSATION_PROMPTS.map((p) => <li key={p}>{p}</li>)}</ul>
        </details>
        <Field label="Notes"><Textarea name="rawNotes" className="min-h-[140px]" placeholder="What did they say about strengths, what they want next, route, location, rates, constraints, follow-up?" /></Field>
        <Field label="Transcript (optional)" hint="Treated as untrusted input. Nothing in it is executed."><Textarea name="transcript" className="min-h-[100px] font-mono text-xs" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Consent reference"><Input name="consentReference" placeholder="e.g. verbal consent on call" defaultValue="verbal-consent-on-call" /></Field>
          <div className="flex items-end pb-1"><Checkbox name="runAI" label="Structure with AI for review" defaultChecked value="true" /></div>
        </div>
        <div className="flex justify-end"><SubmitButton pendingText="Structuring…"><Sparkles className="h-3.5 w-3.5" /> Save and structure</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function RelocationDrawer({ personId, profile, label = "Update relocation" }: { personId: string; profile: RelocationProfile | null; label?: string }) {
  return (
    <Drawer trigger={<Button variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> {label}</Button>} title="Relocation profile" description="Advisory pipeline. Separate from any recruitment fee.">
      <form action={upsertRelocation} className="space-y-4">
        <input type="hidden" name="personId" value={personId} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current location"><Input name="currentLocation" defaultValue={profile?.currentLocation ?? ""} /></Field>
          <Field label="Target location"><Input name="targetLocation" defaultValue={profile?.targetLocation ?? ""} placeholder="Dubai, UAE" /></Field>
        </div>
        <Field label="Move window"><Input name="targetMoveWindow" defaultValue={profile?.targetMoveWindow ?? ""} placeholder="Within 6 months" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Checkbox name="familyMove" label="Family move" defaultChecked={profile?.familyMove} />
          <Checkbox name="schoolGuidanceInterest" label="School guidance" defaultChecked={profile?.schoolGuidanceInterest} />
          <Checkbox name="housingGuidanceInterest" label="Housing guidance" defaultChecked={profile?.housingGuidanceInterest} />
          <Checkbox name="relocationAdvisoryInterest" label="Wants advisory service" defaultChecked={profile?.relocationAdvisoryInterest} />
          <Checkbox name="employerSponsored" label="Employer funded" defaultChecked={profile?.employerSponsored} />
        </div>
        <Field label="Advisory status"><Select name="advisoryStatus" defaultValue={profile?.advisoryStatus ?? "INTEREST_CAPTURED"}>{Object.entries(ADVISORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Notes"><Textarea name="notes" defaultValue={profile?.notes ?? ""} /></Field>
        <div className="flex justify-end"><SubmitButton>Save</SubmitButton></div>
      </form>
    </Drawer>
  );
}
