/**
 * One money formatter for the whole platform.
 *
 * There were five: two in the app, three in the prototype, each with slightly different options, so
 * the same amount could render as "£1,350", "GBP 1,350" or "£1.4K" depending on which screen you
 * were looking at. This is the only one now.
 *
 * On symbols: `currencyDisplay: "narrowSymbol"` is what gives the official mark rather than the
 * disambiguated code — "$" not "US$", "£" not "GB£". The UAE dirham has no narrow symbol in any
 * en-GB locale data, so Intl renders the ISO code "AED", which is the correct and official way to
 * write it in English. The new dirham mark introduced in 2025 has effectively no font coverage, so
 * putting it in the interface would give most people a blank box; `ARABIC_SYMBOL` is here for
 * anyone who wants د.إ instead, but "AED" is the default and is not a fallback or a compromise.
 *
 * Shared by the Next.js app and the browser prototype. No I/O.
 */

/** The currencies this network actually quotes in. */
export const CURRENCIES = ["AED", "GBP", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number] | string;

export const ARABIC_SYMBOL: Record<string, string> = { AED: "د.إ", SAR: "ر.س", QAR: "ر.ق" };

/** What a currency looks like on screen, for a picker or a legend. */
export function symbolOf(currency: Currency, locale = "en-GB"): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? String(currency);
  } catch {
    return String(currency);
  }
}

const opts = (currency: Currency, extra: Intl.NumberFormatOptions = {}): Intl.NumberFormatOptions => ({
  style: "currency",
  currency,
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
  ...extra,
});

/**
 * "AED 4,500" · "£1,350" · "$95,000". A non-breaking space between a code and its number is
 * replaced with a normal one, because it breaks string matching in tests and copy-paste for users.
 */
export function money(value: number | null | undefined, currency: Currency = "AED", locale = "en-GB"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, opts(currency)).format(value).replace(/ /g, " ");
  } catch {
    return `${currency} ${Math.round(value).toLocaleString(locale)}`;
  }
}

/** "AED 75.6K" · "£1.4M". For a figure in a tile, where the exact digits are not the point. */
export function moneyCompact(value: number | null | undefined, currency: Currency = "AED", locale = "en-GB"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try {
    // ICU gives "75.6k" in some builds and "75.6K" in others; pin it so the same number reads the
    // same way in the app, in a test, and in a screenshot.
    return new Intl.NumberFormat(locale, opts(currency, { notation: "compact", maximumFractionDigits: 1 }))
      .format(value).replace(/\u00a0/g, " ").replace(/([\d.])([kmbt])\b/g, (_m, d, u) => d + u.toUpperCase());
  } catch {
    return money(value, currency, locale);
  }
}

/**
 * Amounts in different currencies are never added together — a single mixed total is a made-up
 * number. This renders them side by side instead: "AED 75,600 · £51,840".
 */
export function moneyMixed(totals: Record<string, number>, primary: Currency = "AED", locale = "en-GB"): string {
  const keys = Object.keys(totals).filter((k) => totals[k]);
  if (!keys.length) return money(0, primary, locale);
  keys.sort((a, b) => (a === primary ? -1 : b === primary ? 1 : a.localeCompare(b)));
  return keys.map((k) => money(totals[k], k, locale)).join(" · ");
}

/** A rate, with its unit: "£1,350/day", "AED 600/hour". */
export function rate(value: number | null | undefined, currency: Currency, per: "day" | "hour" | "year" | "month"): string {
  if (value === null || value === undefined) return "—";
  return `${money(value, currency)}/${per}`;
}
