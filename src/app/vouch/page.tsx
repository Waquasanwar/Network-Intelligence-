import { prisma } from "@/lib/db";
import { readReference, REFERENCE_RELATIONS } from "@/lib/reference-link";
import { answerReference } from "@/server/actions/references";
import { BrandMark } from "@/components/ui/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { Guide } from "@/components/ui/guide";
import { Check, MailQuestion } from "lucide-react";

export const metadata = { title: "A reference", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  details: "Check your name and where you worked together, then send it again.",
  consent: "Please tick the box to confirm we may keep what you have written.",
  throttled: "Too many attempts from this connection. Wait a few minutes, then try again.",
};

/**
 * Where someone outside the network answers a request for a reference. No login: the sealed link
 * is the permission. The page shows only the name of the person who asked, which the referee
 * already knows, and nothing else about them or the network.
 */
export default async function VouchPage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string; error?: string }> }) {
  const sp = await searchParams;
  const id = sp.done ? null : readReference(sp.t);
  const req = id ? await prisma.referenceRequest.findUnique({ where: { id }, include: { person: { select: { firstName: true, lastName: true } }, tenant: { select: { brandName: true, name: true } } } }) : null;
  const open = !!req && req.status === "SENT" && req.expiresAt > new Date();
  if (open && !req!.openedAt) await prisma.referenceRequest.updateMany({ where: { id: req!.id, openedAt: null }, data: { openedAt: new Date() } });
  const network = req?.tenant.brandName ?? req?.tenant.name ?? "the network";
  const first = req?.person.firstName ?? "";
  const thisYear = new Date().getFullYear();
  // Said truthfully either way: the person asked themselves, or the team asked for them.
  const byTeam = !!req?.createdById;

  return (
    <main className="relative min-h-screen bg-canvas text-ink px-5 py-10 sm:py-16">
      <div className="ambient" aria-hidden="true" />
      <div className="relative z-[1] mx-auto w-full max-w-[520px]">
        <div className="flex items-center gap-2.5 mb-8"><BrandMark className="h-6 w-auto text-ink" /><span className="font-display is-small text-[17px]">{APP_NAME}</span></div>

        {sp.done ? (
          <div className="widget p-7 sm:p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-ink"><Check className="h-5 w-5" /></span>
            <h1 className="font-display text-[26px] leading-[1.15] mt-5">Thank you. That is everything.</h1>
            <p className="text-[14.5px] text-ink-muted mt-2.5 leading-[1.55]">Your reference has been recorded. You can close this page.</p>
          </div>
        ) : open ? (
          <>
            <h1 className="font-display text-[30px] leading-[1.1] text-balance">{byTeam ? `We would value a few words from you on ${first} ${req!.person.lastName}'s work.` : `${first} ${req!.person.lastName} has asked you to say how you know their work.`}</h1>
            <p className="text-[14.5px] text-ink-muted mt-3 leading-[1.55]">{first} is part of {network}, a network of people known first hand. A few honest lines from someone who has seen them work counts for more than anything they could say themselves.</p>
            {sp.error && ERRORS[sp.error] ? <div role="alert" className="mt-6 rounded-[12px] bg-risk-100 px-3.5 py-2.5 text-[13px] text-risk">{ERRORS[sp.error]}</div> : null}
            <Guide
              className="mt-6"
              intro={`A few short questions about ${first}. About a minute.`}
              action={answerReference}
              hidden={{ t: sp.t! }}
              extra={<div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>}
              submit="Send my reference"
              review="Here is your reference"
              steps={[
                { name: "name", kind: "text", ask: "First, is this your name?", short: "Your name", initial: req!.refereeName, min: 2, max: 120 },
                { name: "relation", kind: "choice", ask: `How do you know ${first}'s work?`, short: "How you know them", options: REFERENCE_RELATIONS.map(([k, l]) => ({ value: k, label: l })) },
                { name: "knownSince", kind: "text", ask: `Since when have you known ${first}?`, short: "Known since", optional: true, placeholder: "A year, e.g. 2016", max: 4, picks: [thisYear - 2, thisYear - 5, thisYear - 10, thisYear - 15].map(String) },
                { name: "where", kind: "text", ask: "Where, and roughly when?", short: "Where", hint: `${byTeam ? "We have it down as" : `${first} described it as`}: “${req!.context}”`, placeholder: "Core banking programme, 2021 to 2023", min: 2, max: 160 },
                { name: "recommend", kind: "choice", ask: `Would you recommend ${first} to someone you know?`, short: "Would recommend", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "Not on what I saw" }] },
                { name: "statement", kind: "long", ask: "What did you see them do well?", short: "What you saw", hint: "Optional. A sentence or two. Specifics beat adjectives.", optional: true, max: 1000 },
                { name: "consent", kind: "confirm", ask: "Last thing", short: "Agreed", hint: `${network} keeps your name and what you have written, and the team there can read it. ${first} is told that you answered, not what you wrote.`, yes: "That is fine" },
              ]}
            />
            <p className="text-[12px] text-ink-faint mt-4 leading-[1.5]">Not sure why you have this? {byTeam ? `The ${network} team sent you this link, because ${first} named you as someone who has seen their work.` : `${first} sent you this link personally.`} If you would rather not answer, simply close the page: nothing is recorded.</p>
          </>
        ) : (
          <div className="widget p-7 sm:p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted ring-1 ring-line"><MailQuestion className="h-5 w-5 text-ink-muted" /></span>
            <h1 className="font-display text-[24px] leading-[1.15] mt-5">{req ? (req.status === "ANSWERED" ? "This reference has already been given" : "This request is no longer open") : "That link is not valid"}</h1>
            <p className="text-[14.5px] text-ink-muted mt-2.5 leading-[1.55]">{req ? (req.status === "ANSWERED" ? "Each link works once. Thank you if that was you." : "It was cancelled, or it has passed its 30 days. Ask the person who sent it for a new one.") : "It may have been cut short when it was copied. Ask the person who sent it to send it again."}</p>
          </div>
        )}
      </div>
    </main>
  );
}
