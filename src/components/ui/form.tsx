import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-faint shadow-[0_1px_1px_rgba(16,24,40,0.03)] transition-[border-color,box-shadow] duration-100 hover:border-line-strong focus:outline-none focus:border-navy/50 focus:ring-3 focus:ring-navy/10 disabled:opacity-60 disabled:bg-surface-muted";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, "h-8", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "py-2 min-h-[80px] leading-5", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(base, "h-8 pr-7 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238d93a0%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_8px_center]", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Field({ label, hint, children, required, className }: { label: string; hint?: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-[12px] font-medium text-ink-muted mb-1">
        {label}
        {required ? <span className="text-amber ml-0.5">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-ink-faint mt-1 leading-4">{hint}</span> : null}
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
