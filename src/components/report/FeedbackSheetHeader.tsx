import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { reportStore, type StoredReport } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function formatSheetDate(ms: number) {
  const d = new Date(ms);
  const date = d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const weekday = d.toLocaleDateString("ko-KR", { weekday: "short" });
  return `${date} (${weekday})`;
}

/** 리포트(Feedback Sheet) 맨 위의 이름·날짜 칸 — 인쇄물에도 그대로 나온다 */
export function FeedbackSheetHeader({ report, modelLabel }: { report: StoredReport; modelLabel: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(report.studentName ?? "");

  const save = () => {
    reportStore.save({ ...report, studentName: name.trim() || undefined });
    setEditing(false);
  };

  return (
    <div className="overflow-hidden rounded-lg border-2 border-foreground/80">
      <div className="flex items-baseline justify-between gap-2 border-b-2 border-foreground/80 bg-muted px-4 py-1.5">
        <h1 className="text-base font-bold tracking-wide">Feedback Sheet</h1>
        <span className="text-xs text-muted-foreground">영어 논설문 피드백</span>
      </div>
      <dl className="grid grid-cols-[4.5rem_1fr] text-sm sm:grid-cols-[4.5rem_1fr_4.5rem_1fr]">
        <dt className="border-b border-r bg-muted/60 px-3 py-1.5 font-medium">이름</dt>
        <dd className="flex items-center gap-2 border-b px-3 py-1.5 sm:border-r" data-testid="sheet-name">
          {editing ? (
            <>
              <Input
                aria-label="학생 이름"
                className="h-8"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
              <Button size="icon" variant="ghost" className="size-8" onClick={save} aria-label="이름 저장">
                <Check />
              </Button>
            </>
          ) : (
            <>
              <span className={report.studentName ? "font-semibold" : "text-muted-foreground"}>{report.studentName || "(이름 없음)"}</span>
              <Button size="icon" variant="ghost" className="no-print size-7" onClick={() => setEditing(true)} aria-label="이름 고치기">
                <Pencil className="size-3.5" />
              </Button>
            </>
          )}
        </dd>
        <dt className="border-b border-r bg-muted/60 px-3 py-1.5 font-medium">날짜</dt>
        <dd className="border-b px-3 py-1.5 tabular-nums" data-testid="sheet-date">{formatSheetDate(report.createdAt)}</dd>
        <dt className="border-r bg-muted/60 px-3 py-1.5 font-medium">주제</dt>
        <dd className="px-3 py-1.5 font-essay sm:col-span-3">{report.topic || "(주제 없음)"}</dd>
      </dl>
      <p className="sr-only">AI 모델: {modelLabel}</p>
    </div>
  );
}
