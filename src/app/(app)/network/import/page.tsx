import { requireInternal } from "@/server/session";
import { PageHeader } from "@/components/ui/page";
import { ImportWizard } from "@/components/domain/import-wizard";

export const metadata = { title: "Import contacts" };

export default async function ImportPage() {
  await requireInternal();
  return (
    <>
      <PageHeader title="Import contacts" description="Bring in your existing list from a spreadsheet. Every person gets a relationship record with you as the owner, so provenance is never missing. Availability starts as 'Needs refresh' until you have spoken." />
      <ImportWizard />
    </>
  );
}
