"use client";

import { useId, type ReactNode } from "react";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.7rem] text-ink-3">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value?: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(value === o ? null : o)}
            className={`rounded-md px-2.5 py-1 text-xs ${value === o ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = "Not set",
}: {
  label: string;
  options: readonly T[];
  value?: T | null;
  onChange: (v: T | null) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <select className="field" value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as T | null)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
}

/** Comma-separated names with suggestions. New names create new pages in Notion. */
export function NamesField({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  const parts = value.split(",");
  const head = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
  const options = suggestions.filter((s) => !head.includes(s)).map((s) => [...head, s].join(", "));
  return (
    <Field label={label} hint={hint}>
      <input className="field" list={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </Field>
  );
}

export const splitNames = (s: string) => [...new Set(s.split(",").map((x) => x.trim().replace(/^[#@+]/, "")).filter(Boolean))];
