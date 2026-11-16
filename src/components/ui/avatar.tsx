import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Quiet, near-monochrome tiles: the name carries the identity, not the colour.
const PALETTES = [
  "bg-[#0c1b33] text-white",
  "bg-[#e6ebf2] text-[#0c1b33]",
  "bg-[#d9f2e7] text-[#0c1b33]",
  "bg-[#eef2f7] text-[#0c1b33] ring-1 ring-inset ring-[#dce3ec]",
];

function hue(p: { firstName: string; lastName: string }) {
  let h = 0;
  for (const ch of `${p.firstName}${p.lastName}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function Avatar({ person, size = "md", className, ring = false }: { person: { firstName: string; lastName: string }; size?: "sm" | "md" | "lg" | "xl"; className?: string; ring?: boolean }) {
  const s = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-[15px]" : size === "xl" ? "h-16 w-16 text-[20px]" : "h-8 w-8 text-xs";
  const core = (
    <span className={cn("inline-flex items-center justify-center rounded-full font-semibold shrink-0", hue(person), s, className)}>
      {initials(person)}
    </span>
  );
  return ring ? <span className="ring inline-flex"><span className="rounded-full bg-surface p-[2px] inline-flex">{core}</span></span> : core;
}
