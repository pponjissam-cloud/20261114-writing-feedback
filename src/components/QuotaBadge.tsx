import { Gauge } from "lucide-react";
import { useQuota } from "@/hooks/useQuota";
import { formatResetLabel } from "@/lib/quota";
import { cn } from "@/lib/utils";

export function QuotaBadge({ keyHash, className }: { keyHash: string; className?: string }) {
  const statuses = useQuota(keyHash);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)} aria-live="polite">
      <span className="inline-flex items-center gap-1 font-medium">
        <Gauge className="size-3.5" aria-hidden />
        오늘 남은 횟수:
      </span>
      <span className="tabular-nums">
        {statuses.map((s, i) => (
          <span key={s.model.id}>
            {i > 0 && <span className="mx-1 text-muted-foreground">/</span>}
            {s.model.shortLabel}{" "}
            <strong className={cn(s.remaining === 0 ? "text-destructive" : s.remaining <= Math.ceil(s.limit * 0.1) && "text-amber-600 dark:text-amber-400")}>
              {s.remaining}
            </strong>
          </span>
        ))}
      </span>
      <span className="text-muted-foreground">다음 초기화: {formatResetLabel(Date.now())}</span>
    </div>
  );
}
