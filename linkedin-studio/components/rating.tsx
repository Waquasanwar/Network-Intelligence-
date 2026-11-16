"use client";

export function Stars({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <span className="stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of 5`}
          className={value != null && n <= value ? "on" : ""}
          onClick={() => onChange(value === n ? null : n)}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function Scale({ value, onChange, max = 10, label }: { value: number | null; onChange: (v: number | null) => void; max?: number; label: string }) {
  return (
    <span className="scale" role="radiogroup" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} className={value === n ? "on" : ""} onClick={() => onChange(value === n ? null : n)}>
          {n}
        </button>
      ))}
    </span>
  );
}

export const RATING_FIELDS = [
  ["hook", "Hook", "Does line one stop the scroll?"],
  ["clarity", "Clarity", "One idea, easy to follow?"],
  ["value", "Value", "Will the reader learn or feel something?"],
  ["voice", "Voice", "Does it sound like you?"],
] as const;
