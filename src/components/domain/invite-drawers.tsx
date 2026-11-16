"use client";
import { UserPlus } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { InviteComposer } from "@/components/domain/invite-share";

/** Invite a contact the network already holds, so they claim that profile rather than start a new one. */
export function InviteContactDrawer({ person, network, from, variant = "secondary", label = "Invite" }: { person: { id: string; name: string; email?: string | null }; network: string; from?: string; variant?: "secondary" | "primary" | "ghost"; label?: string }) {
  return (
    <Drawer trigger={<Button size="sm" variant={variant}><UserPlus className="h-3.5 w-3.5" /> {label}</Button>} title={`Invite ${person.name.split(/\s+/)[0]} to join`} description="They create a login and take charge of the profile you already hold for them. Nothing is duplicated.">
      <InviteComposer person={person} network={network} from={from} />
    </Drawer>
  );
}
