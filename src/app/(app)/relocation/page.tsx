import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Stat } from "@/components/ui/stat";
import { Badge, Chip } from "@/components/ui/badge";
import { PersonLink } from "@/components/domain/person-link";
import { RelocationDrawer } from "@/components/domain/person-drawers";
import { ADVISORY_LABELS } from "@/lib/labels";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Select, Field } from "@/components/ui/form";
import { fullName } from "@/lib/utils";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = { title: "Relocation" };

export default async function RelocationPage() {
  const user = await requireInternal();
  const [profiles, candidates] = await Promise.all([
    prisma.relocationProfile.findMany({ where: { person: { tenantId: user.tenantId } }, include: { person: true }, orderBy: { updatedAt: "desc" } }),
    prisma.person.findMany({ where: { tenantId: user.tenantId, relocationProfile: null }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
  ]);
  const active = profiles.filter((p) => !["COMPLETED", "NOT_PROCEEDING"].includes(p.advisoryStatus));

  async function start(formData: FormData) {
    "use server";
    redirect(`/network/${String(formData.get("personId"))}?tab=relocation`);
  }

  return (
    <>
      <PageHeader title="Relocation advisory" description="Location context already lives in each profile. Advisory is a separate paid service, funded by the individual or their employer, never bundled into a recruitment fee." actions={
        <Drawer trigger={<Button><Plus className="h-3.5 w-3.5" /> Capture interest</Button>} title="Capture relocation interest" description="Pick a person, then complete their relocation profile.">
          <form action={start} className="space-y-4">
            <Field label="Person"><Select name="personId" defaultValue="">{[<option key="" value="" disabled>Choose…</option>, ...candidates.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)]}</Select></Field>
            <div className="flex justify-end"><Button type="submit">Continue</Button></div>
          </form>
        </Drawer>
      } />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Active pipeline" value={active.length} />
        <Stat label="Wants advisory" value={profiles.filter((p) => p.relocationAdvisoryInterest).length} tone="teal" />
        <Stat label="Employer funded" value={profiles.filter((p) => p.employerSponsored).length} />
        <Stat label="Family moves" value={profiles.filter((p) => p.familyMove).length} />
      </div>
      {profiles.length === 0 ? <EmptyState title="No relocation interest captured" /> : (
        <div className="rounded-[16px] border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
          <table className="data">
            <thead><tr><th>Person</th><th>Current</th><th>Target</th><th>Window</th><th>Interest</th><th>Funding</th><th>Status</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.personId}>
                  <td><PersonLink person={p.person} /></td>
                  <td className="text-xs">{p.currentLocation ?? "—"}</td>
                  <td className="text-xs font-medium">{p.targetLocation ?? "—"}</td>
                  <td className="text-xs text-ink-muted">{p.targetMoveWindow ?? "—"}</td>
                  <td><div className="flex flex-wrap gap-1">{p.relocationAdvisoryInterest ? <Chip>advisory</Chip> : null}{p.familyMove ? <Chip>family</Chip> : null}{p.schoolGuidanceInterest ? <Chip>schools</Chip> : null}{p.housingGuidanceInterest ? <Chip>housing</Chip> : null}</div></td>
                  <td>{p.employerSponsored ? <Badge tone="teal">employer</Badge> : <Badge>individual</Badge>}</td>
                  <td><Badge tone={p.advisoryStatus === "ACTIVE" ? "teal" : p.advisoryStatus === "NOT_PROCEEDING" ? "neutral" : "navy"}>{ADVISORY_LABELS[p.advisoryStatus]}</Badge></td>
                  <td className="text-xs text-ink-muted max-w-[240px]">{p.notes ?? "—"}</td>
                  <td className="text-right"><RelocationDrawer personId={p.personId} profile={p} label="Edit" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
