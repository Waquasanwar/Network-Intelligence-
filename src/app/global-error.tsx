"use client";

/** Last resort: the root layout itself failed. Plain markup only, since nothing else is available. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#eef0f5", color: "#0c1b33", margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: "#3b475b", marginTop: 10 }}>Nothing was lost. Try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 20, height: 44, padding: "0 20px", borderRadius: 999, border: 0, background: "#0c1b33", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
