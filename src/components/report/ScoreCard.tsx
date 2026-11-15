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

/** ① 평가 결과 — 첫 장에 ①~③이 모두 들어가도록 높이를 최소화한 형태 */
export function ScoreCard({ summary, previous }: { summary: ScoreSummary; previous?: ScoreSummary | null }) {
  return (
    <section aria-labelledby="sec-score">
      <SectionTitle no="①" title="평가 결과" sub="100점 만점" />
      <Card>
        <CardContent className="flex gap-3 p-3">
          <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-md border-2 border-redpen/70 py-1 text-redpen" id="sec-score">
            <span className="text-[0.65rem] font-medium text-foreground">총점</span>
            <span className="font-essay text-4xl font-bold leading-none tabular-nums" data-testid="total-score">
              {summary.total}
            </span>
            <span className="text-[0.65rem] text-muted-foreground">/ {summary.maxTotal}</span>
            {previous && <Diff value={summary.total - previous.total} className="mt-0.5 text-[0.7rem] font-semibold" />}
          </div>
          <ul className="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {summary.items.map((item) => {
              const prev = previous?.items.find((p) => p.key === item.key);
              const pct = Math.round(item.ratio * 100);
              return (
                <li key={item.key} className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-[4.6rem] shrink-0 whitespace-nowrap font-medium">{item.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={item.max} aria-valuenow={item.score} aria-label={`${item.label} 점수`}>
                      <div className={cn("h-full rounded-full", pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-redpen")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-11 shrink-0 text-right tabular-nums">
                      <strong>{item.score}</strong>
                      <span className="text-muted-foreground">/{item.max}</span>
                    </span>
                    {prev && <Diff value={item.score - prev.score} className="w-7 shrink-0 text-[0.65rem]" />}
                  </div>
                  <p className="text-[0.7rem] leading-snug text-muted-foreground">{item.rationale}</p>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
