import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ScoreSummary } from "@/lib/scoring";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SectionTitle } from "./SectionTitle";

function Diff({ value, className }: { value: number; className?: string }) {
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular-nums", value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-redpen" : "text-muted-foreground", className)}>
      <Icon className="size-3" aria-hidden />
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

export function ScoreCard({ summary, previous }: { summary: ScoreSummary; previous?: ScoreSummary | null }) {
  return (
    <section aria-labelledby="sec-score" className="print-avoid-break">
      <SectionTitle no="①" title="평가 결과" sub="100점 만점" />
      <Card>
        <CardContent className="grid gap-6 p-5 sm:grid-cols-[10rem_1fr]">
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-redpen/70 p-4 text-redpen" id="sec-score">
            <span className="text-sm font-medium text-foreground">총점</span>
            <span className="font-essay text-6xl font-bold leading-none tabular-nums" data-testid="total-score">
              {summary.total}
            </span>
            <span className="text-sm text-muted-foreground">/ {summary.maxTotal}</span>
            {previous && (
              <span className="mt-2 text-xs text-foreground">
                이전 {previous.total}점 → <Diff value={summary.total - previous.total} className="font-semibold" />
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-3">
            {summary.items.map((item) => {
              const prev = previous?.items.find((p) => p.key === item.key);
              const pct = Math.round(item.ratio * 100);
              return (
                <li key={item.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="tabular-nums">
                      <strong>{item.score}</strong>
                      <span className="text-muted-foreground"> / {item.max}</span>
                      {prev && <Diff value={item.score - prev.score} className="ml-2 text-xs" />}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={item.max} aria-valuenow={item.score} aria-label={`${item.label} 점수`}>
                    <div className={cn("h-full rounded-full", pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-redpen")} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
