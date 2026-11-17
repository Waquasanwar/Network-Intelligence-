// Appearance settings. The whole palette is derived in CSS from one accent colour (--brand),
// so a preset or any custom hex re-colours every surface, chip and chart consistently.

export type Mode = "system" | "light" | "dark";
export type Tint = "off" | "subtle" | "vivid";
export type Corners = "sharp" | "soft" | "round";
export type Font = "sans" | "rounded" | "serif" | "mono";
export type Headings = "condensed" | "sans";

export interface Theme {
  mode: Mode;
  accent: string; // #rrggbb
  tint: Tint;
  corners: Corners;
  font: Font;
  headings: Headings;
}

// Snow grey paper, graphite ink, azure for action. Set in IBM Plex.
export const PRESETS: Array<{ name: string; hex: string }> = [
  { name: "Azure", hex: "#1c6fd6" },
  { name: "Graphite", hex: "#3d4550" },
  { name: "Teal", hex: "#0f7d74" },
  { name: "Cobalt", hex: "#3b4fd8" },
  { name: "Signal orange", hex: "#d4561c" },
  { name: "Plum", hex: "#7a3f8f" },
];

export const DEFAULT_THEME: Theme = { mode: "light", accent: "#1c6fd6", tint: "off", corners: "round", font: "sans", headings: "condensed" };

export const THEME_COOKIE = "journal_theme";

const TINT: Record<Tint, string> = { off: "0%", subtle: "3%", vivid: "7%" };
const RADIUS: Record<Corners, string> = { sharp: "0.25rem", soft: "0.5rem", round: "0.75rem" };
export const FONTS: Record<Font, { label: string; stack: string }> = {
  sans: { label: "Plex Sans", stack: 'var(--font-plex), "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif' },
  rounded: { label: "Rounded", stack: 'ui-rounded, "SF Pro Rounded", "Nunito", "Quicksand", "Varela Round", system-ui, sans-serif' },
  serif: { label: "Editorial", stack: '"Iowan Old Style", "Charter", "Source Serif Pro", ui-serif, Georgia, serif' },
  mono: { label: "Plex Mono", stack: 'var(--font-plex-mono), "IBM Plex Mono", ui-monospace, Menlo, monospace' },
};

export const DISPLAY_FONTS: Record<Headings, { label: string; stack: string }> = {
  condensed: { label: "Plex Condensed", stack: 'var(--font-plex-cond), "IBM Plex Sans Condensed", var(--font)' },
  sans: { label: "Same as text", stack: "var(--font)" },
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
      mode: t.mode === "light" || t.mode === "dark" || t.mode === "system" ? t.mode : DEFAULT_THEME.mode,
      accent: t.accent && HEX.test(t.accent) ? t.accent.toLowerCase() : DEFAULT_THEME.accent,
      tint: t.tint && t.tint in TINT ? t.tint : DEFAULT_THEME.tint,
      corners: t.corners && t.corners in RADIUS ? t.corners : DEFAULT_THEME.corners,
      font: t.font && t.font in FONTS ? t.font : DEFAULT_THEME.font,
      headings: t.headings === "sans" ? "sans" : "condensed",
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
    "--font-heading": DISPLAY_FONTS[t.headings].stack,
  };
}
