import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, interactive = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cn("widget", interactive && "lift cursor-pointer", className)} {...props} />;
}

export function CardHeader({ className, title, description, action }: { className?: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-6 pt-6 pb-3", className)}>
      <div className="min-w-0 flex-1 basis-[240px]">
        <h3 className="font-display is-small text-[17px] text-ink leading-[1.25]">{title}</h3>
        {description ? <p className="text-[12.5px] text-ink-muted mt-1 leading-[1.45]">{description}</p> : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}
