import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, interactive = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cn("rounded-[16px] border border-line bg-surface shadow-[var(--shadow-card)]", interactive && "lift cursor-pointer", className)} {...props} />;
}

export function CardHeader({ className, title, description, action }: { className?: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-2", className)}>
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold text-ink leading-5">{title}</h3>
        {description ? <p className="text-[12.5px] text-ink-muted mt-0.5 leading-4">{description}</p> : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}
