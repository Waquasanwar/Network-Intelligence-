import { ShieldAlert } from "lucide-react";

/** Why a requested change was not made, in plain words. Codes come from server actions via ?notice=. */
const NOTICES: Record<string, string> = {
  "reveal-role": "Only an owner or admin can release someone's name. Ask one of them to make this change.",
  "reveal-consent": "Their name was not released: record that they have agreed to this introduction first.",
  "member-summary": "Not opened to members yet: write the short summary members will read first. They never see the client's own words.",
  "reveal-withdrawn": "Their name was not released: they have asked not to be put forward, switched off sharing their name, or asked to be deleted.",
};

export function Notice({ code }: { code?: string | null }) {
  const text = code ? NOTICES[code] : null;
  if (!text) return null;
  return (
    <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-[14px] border border-amber/30 bg-amber-100 px-4 py-3 text-[13px] text-ink">
      <ShieldAlert className="h-4 w-4 flex-none mt-0.5 text-amber" />
      <span>{text}</span>
    </div>
  );
}
