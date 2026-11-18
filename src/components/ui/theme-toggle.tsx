"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, themeFrom, type Theme } from "@/lib/brand";

/** Switches between day (the default) and night. Remembered for a year in a cookie, so the server
 *  draws the right theme on the first paint and nothing flashes. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { setTheme(themeFrom(document.documentElement.dataset.theme)); }, []);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const flip = () => {
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setTheme(next);
  };
  return (
    <button type="button" onClick={flip} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/70 text-ink-muted backdrop-blur hover:text-ink hover:border-line-strong transition-colors cursor-pointer", className)}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
