"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6">
      <h1 className="text-lg font-semibold">Couldn&apos;t load your journal</h1>
      <p className="mt-2 text-sm text-ink-2">
        This usually means Notion turned the request down. Check these:
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
        <li>
          <code>NOTION_TOKEN</code> is your integration&apos;s secret.
        </li>
        <li>
          The <strong>Work Journal</strong> page is shared with that integration (••• menu → Connections).
        </li>
        <li>
          The three <code>NOTION_*_DS</code> IDs match your databases.
        </li>
      </ol>
      {error.digest && <p className="mt-3 text-xs text-ink-3">Reference: {error.digest}</p>}
      <button onClick={reset} className="btn btn-primary mt-5">
        Try again
      </button>
    </div>
  );
}
