"use client";

/** Opens the ⌘K copilot from anywhere on the page. */
export function AskButton({ label = "Ask your copilot" }: { label?: string }) {
  return (
    <button type="button" className="btn small ask-btn" onClick={() => window.dispatchEvent(new Event("copilot:open"))}>
      <span className="spark" aria-hidden>✦</span> {label} <kbd>⌘K</kbd>
    </button>
  );
}
