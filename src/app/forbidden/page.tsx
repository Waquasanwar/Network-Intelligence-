import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-sm font-semibold text-risk">Not permitted</div>
        <p className="text-[13px] text-ink-muted mt-1 max-w-sm">Your role does not have access to that area. This request has been recorded.</p>
        <Link href="/" className="inline-block mt-4 text-[13px] text-navy underline underline-offset-4">Back to your workspace</Link>
      </div>
    </div>
  );
}
