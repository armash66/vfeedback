import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; text: string; className: string }> = {
  new: {
    label: "New",
    text: "Received and awaiting review",
    className: "bg-secondary text-secondary-foreground border-transparent",
  },
  in_progress: {
    label: "In progress",
    text: "Currently being looked into",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  resolved: {
    label: "Resolved",
    text: "Addressed and resolved",
    className: "bg-success/10 text-success border-success/20",
  },
  rejected: {
    label: "Rejected",
    text: "Closed or not actionable",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function getStatusText(status: string): string {
  return STATUS_CONFIG[status.toLowerCase()]?.text || status;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const config = STATUS_CONFIG[normalized] ?? {
    label: status,
    text: status,
    className: "bg-secondary text-secondary-foreground border-transparent",
  };

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium border", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
