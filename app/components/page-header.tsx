import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  width = "64ch",
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  width?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className="text-muted-foreground text-sm font-medium">{eyebrow}</p>}
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance break-words">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm leading-relaxed break-words" style={{ maxWidth: width }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
