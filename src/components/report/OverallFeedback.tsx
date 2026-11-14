import { ThumbsUp, Wrench } from "lucide-react";
import type { Feedback } from "@/lib/schema";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "./SectionTitle";

function List({ items, tone }: { items: Feedback["overall"]["strengths"]; tone: "good" | "improve" }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={i} className="text-sm">
          <p>{it.point}</p>
          {it.evidence && (
            <blockquote className={`mt-1 border-l-2 pl-2 font-essay text-[0.95em] italic text-muted-foreground ${tone === "good" ? "border-emerald-400" : "border-redpen/60"}`}>
              “{it.evidence}”
            </blockquote>
          )}
        </li>
      ))}
    </ul>
  );
}

export function OverallFeedback({ overall }: { overall: Feedback["overall"] }) {
  return (
    <section className="print-avoid-break">
      <SectionTitle no="②" title="종합 피드백" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
              <ThumbsUp className="size-4" aria-hidden /> 잘한 점
            </h3>
            <List items={overall.strengths} tone="good" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 font-semibold text-redpen">
              <Wrench className="size-4" aria-hidden /> 더 좋아질 점
            </h3>
            <List items={overall.weaknesses} tone="improve" />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
