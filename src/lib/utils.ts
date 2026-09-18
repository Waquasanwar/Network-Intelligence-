import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fullName(p: { firstName: string; lastName: string; preferredName?: string | null }) {
  return `${p.preferredName ?? p.firstName} ${p.lastName}`.trim();
}

export function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

export function formatMoney(value: number | string | null | undefined, currency = "GBP") {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function parseList(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Compact money for tiles: £213k, £1.2m. */
export function formatMoneyCompact(value: number | null | undefined, currency = "GBP") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
}
