import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Flat fills drawn from the brand: navy, mint, and two quiet neutrals.
const PALETTES = [
  "bg-[#0c1b33] text-[#f3f4f0]",
  "bg-[#7ee3bc] text-[#0c1b33]",
  "bg-[#24344f] text-[#f3f4f0]",
  "bg-[#dfe3e8] text-[#0c1b33]",
  "bg-[#cfeee0] text-[#0c1b33]",
];

function hue(p: { firstName: string; lastName: string }) {
  let h = 0;
  for (const ch of `${p.firstName}${p.lastName}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function Avatar({ person, size = "md", className, ring = false }: { person: { firstName: string; lastName: string }; size?: "sm" | "md" | "lg" | "xl"; className?: string; ring?: boolean }) {
  const s = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-[15px]" : size === "xl" ? "h-16 w-16 text-[20px]" : "h-8 w-8 text-xs";
  const core = (
    <span className={cn("inline-flex items-center justify-center rounded-full font-bold shrink-0 tracking-tight", hue(person), s, className)}>
      {initials(person)}
    </span>
  );
  return ring ? <span className="ring inline-flex"><span className="rounded-full bg-surface p-[2px] inline-flex">{core}</span></span> : core;
}
