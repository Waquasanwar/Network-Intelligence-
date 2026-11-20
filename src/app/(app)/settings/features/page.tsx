import Link from "next/link";
import { redirect } from "next/navigation";
import { requireInternal } from "@/server/session";
import { canSeeMoney } from "@/lib/authz";
import { PageHeader } from "@/components/ui/page";
import { loadFeatures } from "@/server/queries";
import { FEATURES } from "@/lib/features";
import { setFeature } from "@/server/actions/settings";

export const metadata = { title: "Features" };

/**
 * The owner's switches. Each feature is built and tested; this is where it goes live for the
 * network, and where it can be paused again. Changes take effect for everyone at once.
 */
export default async function FeaturesPage() {
  const user = await requireInternal();
  if (!canSeeMoney(user)) redirect("/forbidden");
  const on = await loadFeatures(user.tenantId);
  return (
    <>
      <PageHeader title="Features" description="Switch features on when you are ready, and off again at any time. Changes apply to everyone in the network at once." />
      <ul className="max-w-[860px] divide-y divide-line rounded-[16px] border border-line bg-surface" data-features>
        {FEATURES.map((f) => {
          const live = on[f.key];
          return (
            <li key={f.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" data-feature={f.key}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[15px] font-semibold text-ink">{f.label}</b>
                  <span className={`tag ${live ? "is-mint" : "is-gold"}`}>{live ? "On" : "Off"}</span>
                  <span className="text-[12px] text-ink-faint">For {f.who.toLowerCase()}</span>
                </div>
                <p className="mt-1 max-w-[62ch] text-[13.5px] leading-[1.5] text-ink-muted">{f.detail}</p>
              </div>
              <form action={setFeature} className="flex-none">
                <input type="hidden" name="key" value={f.key} />
                <input type="hidden" name="on" value={live ? "0" : "1"} />
                <button type="submit" role="switch" aria-checked={live} aria-label={`${f.label}: ${live ? "on, switch off" : "off, switch on"}`} className="switch">
                  <span className="switch-knob" aria-hidden="true" />
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 max-w-[860px] text-[13px] text-ink-faint">Search for companies and agencies is switched on per account, in <Link href="/requirements?tab=accounts" className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline">Requirements → Accounts</Link>.</p>
    </>
  );
}
