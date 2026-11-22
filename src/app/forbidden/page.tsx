import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export const metadata = { title: "Not permitted" };

export default function Forbidden() {
  return (
    <main className="min-h-screen grid place-items-center bg-canvas px-4">
      <div className="max-w-[420px] text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface text-risk shadow-[var(--shadow-card)]" aria-hidden="true"><ShieldAlert className="h-5 w-5" /></span>
        <h1 className="mt-5 font-display text-[24px] font-semibold text-ink">This area is not part of your access</h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-muted">Your role does not include this page. We have noted the attempt, as we do for every area that is closed to a role.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-canvas hover:opacity-90"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to your home</Link>
      </div>
    </main>
  );
}
