import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas px-5 text-ink">
      <div className="max-w-[440px] text-center">
        <BrandMark className="h-7 w-auto mx-auto text-ink" />
        <h1 className="font-display text-[28px] mt-6">We could not find that page</h1>
        <p className="text-[14.5px] text-ink-muted mt-2.5 leading-[1.55]">It may have been moved or removed, or the link may be incomplete.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-navy px-5 text-[14px] font-semibold text-white hover:bg-navy-600 dark:text-canvas">Back to the start</Link>
      </div>
    </main>
  );
}
