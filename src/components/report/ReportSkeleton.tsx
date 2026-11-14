import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ReportSkeleton({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <p className="flex items-center gap-2 text-sm font-medium text-redpen" role="status" aria-live="polite">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {message}
      </p>
      <Card>
        <CardContent className="grid gap-6 p-5 sm:grid-cols-[10rem_1fr]">
          <Skeleton className="h-36" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
