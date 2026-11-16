import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <h1 className="text-lg font-semibold">Entry not found</h1>
      <p className="mt-2 text-sm text-ink-3">It may have been deleted in Notion.</p>
      <Link href="/timeline" className="btn mt-4">Back to timeline</Link>
    </div>
  );
}
