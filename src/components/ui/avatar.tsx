import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PALETTES = [
  "from-[#1b2f5e] to-[#3b5ba9]",
  "from-[#0d7a6f] to-[#14b8a6]",
  "from-[#334155] to-[#64748b]",
  "from-[#3b5ba9] to-[#14b8a6]",
];

function hue(p: { firstName: string; lastName: string }) {
  let h = 0;
  for (const ch of `${p.firstName}${p.lastName}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function Avatar({ person, size = "md", className, ring = false }: { person: { firstName: string; lastName: string }; size?: "sm" | "md" | "lg" | "xl"; className?: string; ring?: boolean }) {
  const s = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-[15px]" : size === "xl" ? "h-16 w-16 text-[20px]" : "h-8 w-8 text-xs";
  const core = (
    <span className={cn("inline-flex items-center justify-center rounded-full bg-gradient-to-br text-white font-semibold shrink-0 tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]", hue(person), s, className)}>
      {initials(person)}
    </span>
  );
  return ring ? <span className="ring inline-flex"><span className="rounded-full bg-surface p-[2px] inline-flex">{core}</span></span> : core;
}
