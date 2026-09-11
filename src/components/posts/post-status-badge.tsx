import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, { variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline"; icon: string }> = {
  DRAFT: { variant: "secondary", icon: "" },
  PENDING_APPROVAL: { variant: "warning", icon: "" },
  CHANGES_REQUESTED: { variant: "warning", icon: "" },
  APPROVED: { variant: "default", icon: "" },
  SCHEDULED: { variant: "default", icon: "" },
  PROCESSING: { variant: "secondary", icon: "" },
  PUBLISHED: { variant: "success", icon: "" },
  FAILED: { variant: "destructive", icon: "" },
  RETRYING: { variant: "warning", icon: "" },
  FAILED_PERMANENTLY: { variant: "destructive", icon: "" },
};

const STATUS_PICKER: Record<string, { variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline"; icon: string }> = {
  DRAFT: { variant: "secondary", icon: "" },
  PENDING_APPROVAL: { variant: "warning", icon: "" },
  APPROVED: { variant: "default", icon: "" },
  SCHEDULED: { variant: "default", icon: "" },
  PROCESSING: { variant: "secondary", icon: "" },
  PUBLISHED: { variant: "success", icon: "" },
  FAILED: { variant: "destructive", icon: "" },
};

export function PostStatusBadge({ status, className }: { status: string; className?: string }) {
  const styles = STATUS_STYLES[status] ?? STATUS_PICKER[status] ?? { variant: "secondary" as const };
  return (
    <Badge variant={styles.variant} className={cn("font-medium", className)} dot>
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}