"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { testNotionAction } from "@/app/actions";
import { Icon } from "./Icon";
import { PageHeader } from "./ui";

const REPO = "https://github.com/Waquasanwar/Network-Intelligence-";
const BRANCH = "claude/busy-faraday-i3f7cl";

interface Check {
  key: string;
  label: string;
  done: boolean;
  why: string;
}

function randomSecret(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
}

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn shrink-0 px-2 py-1 text-xs"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      <Icon name={done ? "check" : "copy"} className="size-3.5" /> {done ? "Copied" : "Copy"}
    </button>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="card relative overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <span className={`num grid size-7 shrink-0 place-items-center rounded-full text-sm font-medium ${done ? "bg-ok text-white" : "bg-[var(--section)] text-white"}`}>
          {done ? <Icon name="check" className="size-4" /> : n}
        </span>
        <h2 className="font-display text-[1.2rem] text-ink">{title}</h2>
        {done && <span className="label ml-auto text-ok">Done</span>}
      </header>
      <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function Ol({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5 marker:text-ink-3">{children}</ol>;
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent-fg underline decoration-1 underline-offset-2">
    {children}
  </a>
);

export function StartGuide({ checks, mode, origin }: { checks: Check[]; mode: "notion" | "demo"; origin: string }) {
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [tz, setTz] = useState("Europe/London");
  const [pending, start] = useTransition();
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const done = checks.filter((c) => c.done).length;
  const is = (k: string) => checks.find((c) => c.key === k)?.done;
  const local = origin.includes("localhost");

  useEffect(() => {
    setSecrets({ AUTH_SECRET: randomSecret(), CRON_SECRET: randomSecret(), CAPTURE_TOKEN: randomSecret(24) });
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London");
  }, []);

  const envRows: Array<[string, string, string]> = [
    ["NOTION_TOKEN", "Your Notion integration secret (step 1)", ""],
    ["APP_PASSCODE", "Any passcode you will remember; you type it to sign in", ""],
    ["AUTH_SECRET", "Random; signs your sign-in cookie", secrets.AUTH_SECRET ?? ""],
    ["JOURNAL_TIMEZONE", "Your timezone, for the 9am Monday brief", tz],
    ["CRON_SECRET", "Random; lets Vercel run the Monday brief", secrets.CRON_SECRET ?? ""],
    ["CAPTURE_TOKEN", "Random; for the phone shortcut in step 4", secrets.CAPTURE_TOKEN ?? ""],
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Get started" subtitle="Five steps from here to using it every day. Most people are done in about fifteen minutes." />

      <div className="card kpi flex flex-wrap items-center gap-4 px-5 py-4" style={{ ["--hue" as string]: done === checks.length ? "var(--ok)" : "var(--section)" }}>
        <div className="kpi-value num text-[2rem] leading-none font-medium">
          {done}/{checks.length}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{done === checks.length ? "All set. Your journal is live." : mode === "demo" ? "Running on sample data until Notion is connected." : "Connected to Notion. A few settings left."}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {checks.map((c) => (
              <span key={c.key} title={c.why} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${c.done ? "bg-ok/12 text-ok" : "guess text-ink-3"}`}>
                {c.done && <Icon name="check" className="size-3" />}
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Step n={1} title="Connect your Notion" done={is("NOTION_TOKEN")}>
        <p>The journal saves into the <strong className="text-ink">Work Journal</strong> page already set up in your Notion, with its three databases: Journal Entries, Projects &amp; Areas and People.</p>
        <Ol>
          <li>Open <A href="https://www.notion.so/profile/integrations">Notion integrations</A> and choose <strong className="text-ink">New integration</strong>. Name it &ldquo;Work Journal&rdquo;, type <strong className="text-ink">Internal</strong>.</li>
          <li>Copy its <strong className="text-ink">Internal Integration Secret</strong>. This is your <code>NOTION_TOKEN</code>.</li>
          <li>In Notion, open the <strong className="text-ink">Work Journal</strong> page → <strong className="text-ink">•••</strong> → <strong className="text-ink">Connections</strong> → add &ldquo;Work Journal&rdquo;. That gives it access to all three databases.</li>
        </Ol>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            className="btn"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await testNotionAction();
                setTest(r.ok ? { ok: true, text: `Connected. Found ${r.data!.entries} entries, ${r.data!.projects} projects and ${r.data!.people} people.` } : { ok: false, text: r.error });
              })
            }
          >
            {pending ? "Testing…" : "Test Notion connection"}
          </button>
          {test && <span className={`text-sm ${test.ok ? "text-ok" : "text-danger"}`}>{test.text}</span>}
        </div>
      </Step>

      <Step n={2} title="Put it online with Vercel" done={is("NOTION_TOKEN") && is("APP_PASSCODE") && is("AUTH_SECRET")}>
        <p>Vercel hosts it for free and gives you a private web address that works on your laptop and phone.</p>
        <Ol>
          <li>Sign in at <A href="https://vercel.com/signup">vercel.com</A> with your GitHub account.</li>
          <li>
            Choose <A href="https://vercel.com/new">Add New → Project</A> and import <code className="break-all">Waquasanwar/Network-Intelligence-</code>.
          </li>
          <li>Set <strong className="text-ink">Root Directory</strong> to <code>journal</code>. Vercel detects Next.js by itself.</li>
          <li>Open <strong className="text-ink">Environment Variables</strong> and add the six below. Fresh random values are generated for you on this page; copy them across.</li>
          <li>
            Press <strong className="text-ink">Deploy</strong>. The journal currently lives on the branch <code className="break-all">{BRANCH}</code>; merge it into <code>main</code> (or set it as the Production Branch under Settings → Git) so your live address uses it.
          </li>
        </Ol>
        <div className="overflow-hidden rounded-[var(--radius)] border border-line">
          {envRows.map(([k, why, v]) => (
            <div key={k} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2.5 last:border-b-0">
              <code className="w-40 shrink-0 text-[0.8rem] font-medium text-ink">{k}</code>
              <span className="min-w-0 flex-1 text-xs text-ink-3">{why}</span>
              {v ? (
                <span className="flex min-w-0 items-center gap-2">
                  <code className="max-w-[14rem] truncate rounded bg-surface-2 px-1.5 py-0.5 text-[0.75rem]">{v}</code>
                  <Copy value={v} />
                </span>
              ) : (
                <span className="text-xs text-ink-3 italic">you provide this</span>
              )}
              {checks.find((c) => c.key === k)?.done && <Icon name="check" className="size-4 text-ok" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-3">
          Repository: <A href={REPO}>{REPO.replace("https://", "")}</A>. Changing a variable later? Redeploy from the Vercel dashboard for it to take effect.
        </p>
      </Step>

      <Step n={3} title="Sign in and put it on your phone">
        <Ol>
          <li>Open your Vercel address{local ? " (it ends in .vercel.app)" : <> (<code>{origin}</code>)</>} and sign in with your passcode.</li>
          <li><strong className="text-ink">iPhone:</strong> in Safari, tap Share → <strong className="text-ink">Add to Home Screen</strong>. <strong className="text-ink">Android:</strong> in Chrome, tap ⋮ → <strong className="text-ink">Install app</strong>. <strong className="text-ink">Laptop:</strong> in Chrome or Edge, use the install icon in the address bar.</li>
          <li>It opens full screen like an app and stays signed in for 90 days.</li>
        </Ol>
      </Step>

      <Step n={4} title="Capture from anywhere" done={is("CAPTURE_TOKEN")}>
        <p>Add entries without opening the app: from Siri, the iPhone Action Button, or a keyboard launcher.</p>
        <Ol>
          <li>On iPhone, open <strong className="text-ink">Shortcuts</strong> → <strong className="text-ink">+</strong> → add <strong className="text-ink">Ask for Input</strong> (Text).</li>
          <li>
            Add <strong className="text-ink">Get Contents of URL</strong>: URL <code className="break-all">{local ? "https://your-app.vercel.app" : origin}/api/capture</code>, Method <strong className="text-ink">POST</strong>, Header <code>Authorization</code> = <code>Bearer</code> followed by your <code>CAPTURE_TOKEN</code>, Request Body <strong className="text-ink">JSON</strong> with key <code>text</code> set to <em>Provided Input</em>.
          </li>
          <li>Name it &ldquo;Journal&rdquo;. Now &ldquo;Hey Siri, Journal&rdquo; or the Action Button takes a note, with the same shorthand as the app (<code>pr:</code>, <code>@person</code>, <code>due:fri</code>…).</li>
        </Ol>
      </Step>

      <Step n={5} title="Your first week">
        <ul className="space-y-2">
          {[
            ["Through the day", "Press C (or + on your phone) and write one line the moment something happens: a decision, an ask, a purchase request, something someone said."],
            ["When you nudge someone", "Press Chased on the item. It counts the chase and resets the clock, so Insights can show who is slow."],
            ["End of day, 5 minutes", "Open Review and confirm what the app guessed: type, project, people, who it's waiting on."],
            ["Monday 9am", "Your brief appears on Today and as a to-do page in Notion: priorities, who to chase, what's due, procurement to push, projects at risk."],
            ["Friday", "Open Insights → Bottlenecks to see what got stuck and with whom, then Projects to update health and milestones."],
          ].map(([when, what]) => (
            <li key={when} className="flex gap-3">
              <span className="label w-36 shrink-0 pt-0.5">{when}</span>
              <span>{what}</span>
            </li>
          ))}
        </ul>
      </Step>
    </div>
  );
}
