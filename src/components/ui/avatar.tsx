import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Soft tints in the brand's own lights. Initials stay dark on light, light on navy, so they read.
const PALETTES = [
  "bg-[linear-gradient(140deg,#dcf7ec,#a9e9d0)] text-[#0b3a2c]",
  "bg-[linear-gradient(140deg,#ffe6e0,#ffc4b8)] text-[#6a1d11]",
  "bg-[linear-gradient(140deg,#e2ecfb,#bcd3f4)] text-[#11305c]",
  "bg-[linear-gradient(140deg,#21365c,#0c1b33)] text-white",
  "bg-[linear-gradient(140deg,#f7efdd,#ecd8b0)] text-[#553b0b]",
];

function hue(p: { firstName: string; lastName: string }) {
  let h = 0;
  for (const ch of `${p.firstName}${p.lastName}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function Avatar({ person, size = "md", className, ring = false }: { person: { firstName: string; lastName: string }; size?: "sm" | "md" | "lg" | "xl"; className?: string; ring?: boolean }) {
  const s = size === "sm" ? "h-7 w-7 text-[11px]" : size === "lg" ? "h-12 w-12 text-[15px]" : size === "xl" ? "h-[72px] w-[72px] text-[22px]" : "h-9 w-9 text-[12.5px]";
  const core = (
    <span className={cn("inline-flex items-center justify-center rounded-full font-semibold shrink-0 shadow-[inset_0_0_0_1px_rgba(12,27,51,0.06)]", hue(person), s, className)}>
      {initials(person)}
    </span>
  );
  return ring ? <span className="ring inline-flex"><span className="rounded-full bg-surface p-[2px] inline-flex">{core}</span></span> : core;
}
