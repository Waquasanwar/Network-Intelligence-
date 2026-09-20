"use client";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createVouch, bookScreening, submitPitch } from "@/server/actions/members";
import { ATTRIBUTES } from "@/lib/fit";
import { HeartHandshake, CalendarClock, Megaphone } from "lucide-react";

export function VouchDrawer({ personId, personName, users, people, asMember }: { personId: string; personName: string; users: { id: string; name: string }[]; people: { id: string; name: string }[]; asMember?: boolean }) {
  return (
    <Drawer trigger={<Button size="sm" variant="secondary"><HeartHandshake className="h-3.5 w-3.5" /> Vouch</Button>} title={`Vouch for ${personName}`} description="Putting your name behind someone. Say what you have seen, and rate how they work if you have observed it.">
      <form action={createVouch} className="space-y-4">
        <input type="hidden" name="personId" value={personId} />
        {asMember ? null : <Field label="Who is vouching" required><Select name="voucher" defaultValue={users[0] ? `USER:${users[0].id}` : ""}><optgroup label="Network owners">{users.map((u) => <option key={u.id} value={`USER:${u.id}`}>{u.name}</option>)}</optgroup><optgroup label="Network members">{people.map((p) => <option key={p.id} value={`PERSON:${p.id}`}>{p.name}</option>)}</optgroup><optgroup label="External"><option value="EXTERNAL:">LinkedIn recommendation or reference (name below)</option></optgroup></Select></Field>}
        {asMember ? null : <Field label="External name and source" hint="Only for external recommendations"><Input name="voucherName" placeholder="e.g. Former CIO, Tier-1 bank" /></Field>}
        <Field label="Context" required><Input name="context" required placeholder="Where you saw them work" /></Field>
        <Field label="What you saw"><Textarea name="statement" placeholder="In a sentence or two. Specifics beat adjectives." /></Field>
        <Checkbox name="wouldRecommend" label="I would recommend them" defaultChecked />
        <div>
          <div className="text-[12.5px] font-medium mb-1.5">How they work (only what you observed)</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">{ATTRIBUTES.map((a) => <label key={a.key} className="text-[12px]"><span className="block text-ink-muted mb-1">{a.label}</span><Select name={`attr:${a.key}`} defaultValue="" className="h-8 text-xs"><option value="">not observed</option>{[1, 2, 3, 4, 5].map((i) => <option key={i} value={i}>{i} · {i <= 2 ? a.low : i >= 4 ? a.high : "in between"}</option>)}</Select></label>)}</div>
        </div>
        <div className="flex justify-end"><SubmitButton pendingText="Saving…">Vouch</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function BookScreeningDrawer({ personId, label = "Book a real call" }: { personId: string; label?: string }) {
  const def = new Date(Date.now() + 2 * 86400e3); def.setHours(10, 0, 0, 0);
  return (
    <Drawer trigger={<Button size="sm" variant="secondary"><CalendarClock className="h-3.5 w-3.5" /> {label}</Button>} title="Book a screening call" description="A real 30-minute conversation, run from the screening script.">
      <form action={bookScreening} className="space-y-4">
        <input type="hidden" name="personId" value={personId} />
        <Field label="When"><Input type="datetime-local" name="startAt" defaultValue={def.toISOString().slice(0, 16)} /></Field>
        <div className="flex justify-end"><SubmitButton pendingText="Booking…">Book</SubmitButton></div>
      </form>
    </Drawer>
  );
}

export function PitchDrawer({ briefId, asPersonId, summary }: { briefId: string; asPersonId?: string; summary: string }) {
  return (
    <Drawer trigger={<Button size="sm"><Megaphone className="h-3.5 w-3.5" /> Pitch with my profile</Button>} title="Pitch for this opportunity" description="Your profile goes with it. Say, in a few sentences, why you and what you have done that is closest to this.">
      <form action={submitPitch} className="space-y-4">
        <input type="hidden" name="briefId" value={briefId} />
        {asPersonId ? <input type="hidden" name="asPersonId" value={asPersonId} /> : null}
        <div className="rounded-[12px] bg-surface-muted px-3 py-2.5 text-[12.5px]">{summary}</div>
        <Field label="Your pitch" required><Textarea name="note" required className="min-h-[120px]" placeholder="What you have done that is closest to this, and why now." /></Field>
        <div className="flex justify-end"><SubmitButton pendingText="Sending…">Send pitch</SubmitButton></div>
      </form>
    </Drawer>
  );
}
