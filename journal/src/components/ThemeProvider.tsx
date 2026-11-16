"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { DEFAULT_THEME, THEME_COOKIE, serializeTheme, themeVars, type Theme } from "@/lib/theme";

const Ctx = createContext<{ theme: Theme; setTheme: (patch: Partial<Theme>) => void; reset: () => void }>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  reset: () => {},
});

export const useTheme = () => useContext(Ctx);

function apply(t: Theme) {
  const root = document.documentElement;
  root.dataset.mode = t.mode;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  // A year-long cookie so the server renders the right colours on the next visit (no flash).
  document.cookie = `${THEME_COOKIE}=${serializeTheme(t)}; path=/; max-age=31536000; samesite=lax`;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') ?? Object.assign(document.createElement("meta"), { name: "theme-color" });
  meta.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim() || t.accent);
  if (!meta.parentNode) document.head.appendChild(meta);
}

export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [theme, set] = useState<Theme>(initial);
  const setTheme = useCallback((patch: Partial<Theme>) => {
    set((prev) => {
      const next = { ...prev, ...patch };
      apply(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    set(DEFAULT_THEME);
    apply(DEFAULT_THEME);
  }, []);
  return <Ctx.Provider value={{ theme, setTheme, reset }}>{children}</Ctx.Provider>;
}
