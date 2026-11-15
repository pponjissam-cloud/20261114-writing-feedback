import { useState } from "react";
import { PencilLine, Target } from "lucide-react";
import type { Feedback } from "@/lib/schema";
import type { ScoreSummary } from "@/lib/scoring";
import { reportStore } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "./SectionTitle";

export function RewriteMission({
  reportId,
  mission,
  summary,
  onRewrite,
  rewriteCostLabel,
  no = "⑤",
}: {
  no?: string;
  reportId: string;
  mission: Feedback["rewriteMission"];
  summary: ScoreSummary;
  onRewrite: () => void;
  rewriteCostLabel: string;
}) {
  const [checks, setChecks] = useState<boolean[][]>(() => reportStore.getChecklist(reportId));

  const toggle = (t: number, c: number) => {
    const next = mission.tasks.map((task, ti) => task.selfCheck.map((_, ci) => checks[ti]?.[ci] ?? false));
    next[t]![c] = !next[t]![c];
    setChecks(next);
    reportStore.setChecklist(reportId, next);
  };

  const total = mission.tasks.reduce((s, t) => s + t.selfCheck.length, 0);
  const done = mission.tasks.reduce((s, t, ti) => s + t.selfCheck.filter((_, ci) => checks[ti]?.[ci]).length, 0);

  return (
    <section>
      <SectionTitle no={no} title="Rewrite 미션" sub={`체크 ${done}/${total}`} />
      <div className="flex flex-col gap-4">
        {mission.tasks.map((task, ti) => {
          const item = summary.items.find((i) => i.key === task.targetKey);
          return (
            <Card key={ti} className="print-avoid-break">
              <CardContent className="p-5">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <Target className="size-4 text-redpen" aria-hidden />
                  미션 {ti + 1} · {item?.label ?? task.targetKey}
                  {item && <span className="font-normal text-muted-foreground tabular-nums">({item.score}/{item.max})</span>}
                </p>
                <p className="mb-3 text-sm">{task.instruction}</p>
                <ul className="flex flex-col gap-1.5">
                  {task.selfCheck.map((label, ci) => {
                    const id = `chk-${reportId}-${ti}-${ci}`;
                    return (
                      <li key={ci}>
                        <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm">
                          <input id={id} type="checkbox" className="mt-0.5 size-4 accent-[var(--redpen)]" checked={checks[ti]?.[ci] ?? false} onChange={() => toggle(ti, ci)} />
                          <span className={checks[ti]?.[ci] ? "text-muted-foreground line-through" : ""}>{label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}

        <Card className="print-avoid-break border-redpen/40 bg-red-50/40 dark:bg-red-950/20">
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-semibold text-redpen">✍️ 영어 선생님 코멘트</p>
            <p className="whitespace-pre-line text-[0.95rem] leading-relaxed">{mission.teacherComment}</p>
          </CardContent>
        </Card>

        <div className="no-print flex flex-col items-start gap-1">
          <Button variant="redpen" size="lg" onClick={onRewrite}>
            <PencilLine /> 다시 써서 제출하기 <span className="text-xs font-normal opacity-90">({rewriteCostLabel})</span>
          </Button>
          <span className="text-xs text-muted-foreground">원문이 채워진 편집기로 이동해요. 고친 글을 제출하면 새 리포트가 만들어지고 이전 점수와 비교해 드려요.</span>
        </div>
      </div>
    </section>
  );
}
