import { ThumbsUp, Wrench } from "lucide-react";
import type { Feedback } from "@/lib/schema";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "./SectionTitle";

function List({ items }: { items: Feedback["overall"]["strengths"] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => (
        <li key={i} className="text-xs leading-snug">
          • {it.point}
          {it.evidence && <span className="ml-1 font-essay italic text-muted-foreground">“{it.evidence}”</span>}
        </li>
      ))}
    </ul>
  );
}

/** ② 종합 피드백 — 한 상자에 두 칸으로 압축 */
export function OverallFeedback({ overall }: { overall: Feedback["overall"] }) {
  return (
    <section>
      <SectionTitle no="②" title="종합 피드백" />
      <Card>
        <CardContent className="grid gap-3 p-3 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ThumbsUp className="size-3.5" aria-hidden /> 잘한 점
            </h3>
            <List items={overall.strengths} />
          </div>
          <div>
            <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold text-redpen">
              <Wrench className="size-3.5" aria-hidden /> 더 좋아질 점
            </h3>
            <List items={overall.weaknesses} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
