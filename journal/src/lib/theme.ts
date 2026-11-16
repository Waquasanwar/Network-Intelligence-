// Appearance settings. The whole palette is derived in CSS from one accent colour (--brand),
// so a preset or any custom hex re-colours every surface, chip and chart consistently.

export type Mode = "system" | "light" | "dark";
export type Tint = "off" | "subtle" | "vivid";
export type Corners = "sharp" | "soft" | "round";
export type Font = "sans" | "rounded" | "serif" | "mono";

export interface Theme {
  mode: Mode;
  accent: string; // #rrggbb
  tint: Tint;
  corners: Corners;
  font: Font;
}

export const PRESETS: Array<{ name: string; hex: string }> = [
  { name: "Iris", hex: "#6d5efc" },
  { name: "Ocean", hex: "#2f6bff" },
  { name: "Lagoon", hex: "#0ea5a4" },
  { name: "Matcha", hex: "#5f9e2f" },
  { name: "Citrus", hex: "#f2b705" },
  { name: "Coral", hex: "#ff6b57" },
  { name: "Fuchsia", hex: "#d946ef" },
  { name: "Graphite", hex: "#3f3f46" },
];

export const DEFAULT_THEME: Theme = { mode: "system", accent: "#6d5efc", tint: "subtle", corners: "soft", font: "sans" };

export const THEME_COOKIE = "journal_theme";

const TINT: Record<Tint, string> = { off: "0%", subtle: "4%", vivid: "9%" };
const RADIUS: Record<Corners, string> = { sharp: "0.375rem", soft: "0.875rem", round: "1.25rem" };
export const FONTS: Record<Font, { label: string; stack: string }> = {
  sans: { label: "Modern", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif' },
  rounded: { label: "Rounded", stack: 'ui-rounded, "SF Pro Rounded", "Nunito", "Quicksand", "Varela Round", system-ui, sans-serif' },
  serif: { label: "Editorial", stack: '"Iowan Old Style", "Charter", "Source Serif Pro", ui-serif, Georgia, serif' },
  mono: { label: "Mono", stack: 'ui-monospace, "JetBrains Mono", "SF Mono", "Cascadia Code", Menlo, Consolas, monospace' },
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Text colour that reads on the accent: white on dark accents, near-black on light ones. */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Pick whichever of white / near-black has the higher contrast ratio.
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.0625) ? "#ffffff" : "#111118";
}

export function parseTheme(raw: string | undefined | null): Theme {
  if (!raw) return DEFAULT_THEME;
  try {
    const t = JSON.parse(decodeURIComponent(raw)) as Partial<Theme>;
    return {
      mode: t.mode === "light" || t.mode === "dark" ? t.mode : "system",
      accent: t.accent && HEX.test(t.accent) ? t.accent.toLowerCase() : DEFAULT_THEME.accent,
      tint: t.tint && t.tint in TINT ? t.tint : DEFAULT_THEME.tint,
      corners: t.corners && t.corners in RADIUS ? t.corners : DEFAULT_THEME.corners,
      font: t.font && t.font in FONTS ? t.font : DEFAULT_THEME.font,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function serializeTheme(t: Theme): string {
  return encodeURIComponent(JSON.stringify(t));
}

/** CSS custom properties set on <html>. Everything else in globals.css derives from these. */
export function themeVars(t: Theme): Record<string, string> {
  return {
    "--brand": t.accent,
    "--brand-ink": inkOn(t.accent),
    "--tint": TINT[t.tint],
    "--radius": RADIUS[t.corners],
    "--font": FONTS[t.font].stack,
  };
}
