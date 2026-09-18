import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition-[background-color,border-color,box-shadow,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:translate-y-px",
  {
    variants: {
      variant: {
        primary: "bg-[linear-gradient(180deg,var(--color-navy-600),var(--color-navy))] text-white hover:brightness-110 shadow-[var(--shadow-button)] dark:text-canvas",
        secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-hover shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
        ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
        teal: "bg-[linear-gradient(180deg,#14b8a6,#0d7a6f)] text-white hover:brightness-105 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_14px_-8px_rgba(13,122,111,0.7)]",
        danger: "bg-risk text-white hover:brightness-95",
        link: "text-navy underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-7 px-2.5 text-[12.5px] rounded-[8px]",
        md: "h-8 px-3.5 text-[13px]",
        lg: "h-10 px-4 text-sm rounded-[12px]",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";

export { buttonVariants };
