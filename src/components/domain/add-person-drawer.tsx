import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { AiAddPersonForm } from "@/components/domain/add-person-ai";
import { Plus } from "lucide-react";

/** Spec §9 step 1: add a person in under 60 seconds. AI drafts the profile; source and provenance stay mandatory. */
export function AddPersonDrawer({ people }: { people: { id: string; firstName: string; lastName: string }[] }) {
  return (
    <Drawer trigger={<Button><Plus className="h-3.5 w-3.5" /> Add person</Button>} title="Add a person" description="Paste a LinkedIn link or a few lines and let the assistant draft it. Where they came from and who knows them stay mandatory — that is the intelligence.">
      <AiAddPersonForm people={people} />
    </Drawer>
  );
}
