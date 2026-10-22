import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      {icon && (
        <div className="bg-muted text-muted-foreground mb-4 flex size-11 items-center justify-center rounded-lg [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h2 className="text-base font-medium">{title}</h2>
      {body && <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
