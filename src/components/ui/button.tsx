import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-navy text-white hover:bg-navy-600 dark:text-canvas",
        accent: "bg-accent text-accent-ink hover:brightness-95",
        secondary: "bg-surface text-ink border border-line-strong hover:border-ink",
        ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
        teal: "bg-accent text-accent-ink hover:brightness-95",
        danger: "bg-risk text-white hover:brightness-95",
        link: "text-ink underline decoration-accent decoration-2 underline-offset-4 px-0 h-auto rounded-none",
      },
      size: {
        sm: "h-8 px-3 text-[12.5px] rounded-[6px]",
        md: "h-9 px-3.5 text-[13px]",
        lg: "h-11 px-5 text-[14px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/** The arrow that closes a call to action: inline, not a chip, and it nudges forward on hover. */
export function ArrowBadge({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("arrow-badge ml-1 inline-flex flex-none", className)}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";

export { buttonVariants };
