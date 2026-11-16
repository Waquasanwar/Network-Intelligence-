import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-[14px] border border-line bg-surface px-3.5 text-[13.5px] text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 hover:border-navy-400 focus:outline-none focus:border-ink focus:ring-[3px] focus:ring-accent/60 disabled:opacity-60 disabled:bg-surface-muted";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "py-2 min-h-[80px] leading-5", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(base, "select-chevron h-10 pr-8 appearance-none", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Field({ label, hint, children, required, className }: { label: string; hint?: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-[12.5px] font-semibold text-ink mb-1.5">
        {label}
        {required ? <span className="text-coral-ink ml-0.5">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[12px] text-ink-faint mt-1 leading-4">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-[13px] text-ink cursor-pointer", className)}>
      <input type="checkbox" className="h-3.5 w-3.5 rounded border-line-strong accent-navy" {...props} />
      {label}
    </label>
  );
}
