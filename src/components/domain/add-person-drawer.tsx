import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addPerson } from "@/server/actions/people";
import { SOURCE_LABELS, RELATIONSHIP_LABELS } from "@/lib/labels";
import { Plus } from "lucide-react";
import { fullName } from "@/lib/utils";

/** Spec §9 step 1: add a person in under 60 seconds. Source and provenance are required. */
export function AddPersonDrawer({ people }: { people: { id: string; firstName: string; lastName: string }[] }) {
  return (
    <Drawer trigger={<Button><Plus className="h-3.5 w-3.5" /> Add person</Button>} title="Add a person" description="Under a minute. Where they came from and who knows them are mandatory — that is the intelligence.">
      <form action={addPerson} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required><Input name="firstName" required autoFocus /></Field>
          <Field label="Last name" required><Input name="lastName" required /></Field>
        </div>
        <Field label="Headline" hint="One line on what they are known for"><Input name="headline" placeholder="e.g. Programme director who stabilises troubled transformations" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current company"><Input name="currentCompany" /></Field>
          <Field label="Current role"><Input name="currentRole" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input name="primaryCity" placeholder="London" /></Field>
          <Field label="Country"><Input name="primaryCountry" placeholder="UK" /></Field>
        </div>
        <Field label="Expertise" hint="Comma separated. Refined later from conversations."><Input name="capabilities" placeholder="Transformation, PMO, cyber security" /></Field>
        <Field label="Email"><Input name="email" type="email" /></Field>
        <div className="border-t border-line pt-4">
          <div className="text-xs font-semibold text-ink mb-2">Relationship provenance</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source" required>
              <Select name="sourceType" required defaultValue="PERSONAL_NETWORK">{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            </Field>
            <Field label="How you know them" required>
              <Select name="relationshipType" required defaultValue="DIRECT">{Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            </Field>
          </div>
          <Field label="Introduced by" className="mt-3" hint="Pick a person already in the network">
            <Select name="introducedById" defaultValue="">
              <option value="">— nobody / direct —</option>
              {people.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
            </Select>
          </Field>
          <div className="mt-3"><Checkbox name="workedTogether" label="I have worked with them directly" /></div>
          <Field label="Private relationship notes" className="mt-3" hint="Never shown to partners or clients."><Textarea name="relationshipNotes" placeholder="Who knows them, what you have seen, anything to remember." /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SubmitButton pendingText="Adding…">Add person</SubmitButton>
        </div>
      </form>
    </Drawer>
  );
}
