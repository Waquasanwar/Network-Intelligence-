"use client";

import Link from "next/link";
import { FONTS, PRESETS, type Corners, type Font, type Mode, type Tint } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";
import { Chip, PageHeader, TypeBadge } from "./ui";

function Swatch({ hex, name, active, onClick, size = "lg" }: { hex: string; name: string; active: boolean; onClick: () => void; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "size-11" : "size-5";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={name}
      title={name}
      className={`group flex flex-col items-center gap-1.5 ${size === "sm" ? "" : "w-16"}`}
    >
      <span
        className={`${dim} rounded-full ring-offset-2 ring-offset-[var(--surface)] transition ${active ? "ring-2 ring-[var(--ink)]" : "group-hover:scale-110"}`}
        style={{ background: `linear-gradient(135deg, ${hex}, color-mix(in oklch, ${hex} 70%, white))` }}
      />
      {size === "lg" && <span className={`text-xs ${active ? "font-medium text-ink" : "text-ink-3"}`}>{name}</span>}
    </button>
  );
}

function Options<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{label}</h3>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-[calc(var(--radius)*0.7)] border border-line bg-surface-2 p-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`rounded-[calc(var(--radius)*0.5)] px-3 py-1.5 text-sm transition ${value === v ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small swatch row + light/dark toggle for the sidebar. */
export function QuickTheme() {
  const { theme, setTheme } = useTheme();
  const nextMode: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
  const icon: Record<Mode, string> = { system: "🌓", light: "☀️", dark: "🌙" };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {PRESETS.slice(0, 6).map((p) => (
          <Swatch key={p.hex} hex={p.hex} name={p.name} size="sm" active={theme.accent === p.hex} onClick={() => setTheme({ accent: p.hex })} />
        ))}
        <button
          type="button"
          onClick={() => setTheme({ mode: nextMode[theme.mode] })}
          className="ml-auto grid size-6 place-items-center rounded-full text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
          title={`Theme: ${theme.mode}. Click to switch.`}
          aria-label={`Colour mode: ${theme.mode}. Switch to ${nextMode[theme.mode]}`}
        >
          {icon[theme.mode]}
        </button>
      </div>
      <Link href="/settings" className="block text-xs text-ink-3 hover:text-accent-fg">
        Customise appearance →
      </Link>
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme, reset } = useTheme();
  const custom = !PRESETS.some((p) => p.hex === theme.accent);

  return (
    <div>
      <PageHeader title="Appearance" subtitle="Pick a colour and style. Changes apply instantly and are remembered on this device." actions={<button className="btn" onClick={reset}>Reset</button>} />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="card space-y-7 p-5">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Accent colour</h3>
            <div className="flex flex-wrap gap-x-2 gap-y-4">
              {PRESETS.map((p) => (
                <Swatch key={p.hex} hex={p.hex} name={p.name} active={theme.accent === p.hex} onClick={() => setTheme({ accent: p.hex })} />
              ))}
              <label className="group flex w-16 cursor-pointer flex-col items-center gap-1.5" title="Choose any colour">
                <span
                  className={`relative grid size-11 place-items-center overflow-hidden rounded-full ring-offset-2 ring-offset-[var(--surface)] ${custom ? "ring-2 ring-[var(--ink)]" : ""}`}
                  style={{ background: custom ? theme.accent : "conic-gradient(#ff6b57, #f2b705, #5f9e2f, #0ea5a4, #2f6bff, #6d5efc, #d946ef, #ff6b57)" }}
                >
                  <span className="text-lg text-white mix-blend-difference">+</span>
                  <input type="color" value={theme.accent} onChange={(e) => setTheme({ accent: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom accent colour" />
                </span>
                <span className={`text-xs ${custom ? "font-medium text-ink" : "text-ink-3"}`}>Custom</span>
              </label>
            </div>
            {custom && <p className="mt-3 font-mono text-xs text-ink-3">{theme.accent}</p>}
          </div>

          <Options<Mode> label="Mode" value={theme.mode} onChange={(mode) => setTheme({ mode })} options={[["system", "🌓 System"], ["light", "☀️ Light"], ["dark", "🌙 Dark"]]} />
          <Options<Tint> label="Background tint" value={theme.tint} onChange={(tint) => setTheme({ tint })} options={[["off", "Off"], ["subtle", "Subtle"], ["vivid", "Vivid"]]} />
          <Options<Corners> label="Corners" value={theme.corners} onChange={(corners) => setTheme({ corners })} options={[["sharp", "Sharp"], ["soft", "Soft"], ["round", "Round"]]} />
          <Options<Font> label="Font" value={theme.font} onChange={(font) => setTheme({ font })} options={(Object.keys(FONTS) as Font[]).map((f) => [f, FONTS[f].label])} />
        </div>

        {/* Live preview */}
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">Preview</p>
          <div className="card glow-focus space-y-3 p-4" tabIndex={-1}>
            <div className="flex items-center gap-2">
              <span className="brand-mark grid size-8 place-items-center rounded-[calc(var(--radius)*0.6)]">✎</span>
              <span className="text-lg font-semibold">
                Good <span className="text-gradient">morning</span>
              </span>
            </div>
            <p className="text-sm text-ink-2">Went with vendor B for the migration, cheaper and SOC2 ready.</p>
            <div className="flex flex-wrap gap-1">
              <TypeBadge type="Decision" short />
              <Chip tone="accent">Data Migration</Chip>
              <Chip>@James</Chip>
              <Chip tone="warn">P2</Chip>
            </div>
            <div className="flex h-16 items-end gap-1.5">
              {[40, 65, 50, 80, 55, 95, 70].map((h, i) => (
                <span key={i} className="flex-1 rounded-t-[4px]" style={{ height: `${h}%`, background: i === 5 ? "var(--accent)" : "var(--seq-light)" }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary">Save</button>
              <button className="btn">Cancel</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="card px-3 py-2.5">
              <div className="text-xl font-semibold text-accent-fg">4</div>
              <div className="text-[0.7rem] text-ink-3">To review</div>
            </div>
            <div className="card px-3 py-2.5">
              <div className="text-xl font-semibold">12</div>
              <div className="text-[0.7rem] text-ink-3">This week</div>
            </div>
            <div className="card px-3 py-2.5">
              <div className="text-xl font-semibold text-danger">2</div>
              <div className="text-[0.7rem] text-ink-3">Overdue</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
