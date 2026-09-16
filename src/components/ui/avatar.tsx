import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Avatar({ person, size = "md", className }: { person: { firstName: string; lastName: string }; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-base" : "h-8 w-8 text-xs";
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full bg-navy-100 text-navy font-semibold shrink-0", s, className)}>
      {initials(person)}
    </span>
  );
}
