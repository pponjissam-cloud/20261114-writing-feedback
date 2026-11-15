import { Fragment, useMemo } from "react";
import { MessageCircle, Minus, Plus } from "lucide-react";
import type { SentenceReview as SentenceReviewData } from "@/lib/schema";
import { buildReviewRows, type ReviewRow } from "@/lib/sentenceReview";
import type { DiffPart } from "@/lib/diff";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "./SectionTitle";
import { cn } from "@/lib/utils";

// 색 규칙: 학생 문장 = 검정, 최소 첨삭 = 회색 바탕글 + 고친 부분만 검정, 추천 = 굵게, 넣을/뺄 문장 = 파랑
const BLUE = "text-blue-600 dark:text-blue-400 print:text-[#1d4ed8]";
const BLACK = "text-neutral-950 dark:text-neutral-50 print:text-black";
const GREY = "text-neutral-400 dark:text-neutral-500 print:text-[#9ca3af]";

function MinimalDiff({ parts }: { parts: DiffPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i} className={GREY}>{p.text}</span>
        ) : p.type === "add" ? (
          <span key={i} className={`${BLACK} font-semibold underline decoration-1 underline-offset-4`}>{p.text}</span>
        ) : (
          <del key={i} className={`${BLACK} mr-1 decoration-1`} aria-label={`삭제: ${p.text}`}>{p.text}</del>
        ),
      )}
    </>
  );
}

function Line({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="grid grid-cols-[3.25rem_1fr] items-baseline gap-2">
      <span className="font-sans text-[0.7rem] font-medium text-muted-foreground">{label}</span>
      <p className={cn("font-essay text-[1.02rem] leading-relaxed", className)}>{children}</p>
    </div>
  );
}

function Note({ text, blue }: { text: string; blue?: boolean }) {
  if (!text) return null;
  return (
    <p className={`ml-[3.75rem] flex items-start gap-1 text-xs ${blue ? BLUE : "text-muted-foreground"}`}>
      <MessageCircle className="mt-0.5 size-3 shrink-0" aria-hidden /> {text}
    </p>
  );
}

function SentenceRow({ row }: { row: Extract<ReviewRow, { kind: "sentence" }> }) {
  if (row.action === "delete") {
    return (
      <li className="print-avoid-break flex gap-3 py-3" data-testid={`sentence-${row.no}`}>
        <span className={`w-7 shrink-0 text-right font-bold tabular-nums ${BLUE}`}>{row.no}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Line label="학생" className={`${BLUE} line-through`}>{row.original}</Line>
          <p className={`ml-[3.75rem] inline-flex items-center gap-1 text-xs font-semibold ${BLUE}`}>
            <Minus className="size-3" aria-hidden /> 이 문장은 빼는 게 좋아요
          </p>
          <Note text={row.note} blue />
        </div>
      </li>
    );
  }
  const recommendedDiffers = row.recommended.trim() !== row.minimal.trim();
  return (
    <li className="print-avoid-break flex gap-3 py-3" data-testid={`sentence-${row.no}`}>
      <span className="w-7 shrink-0 text-right font-bold tabular-nums">{row.no}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Line label="학생" className={BLACK}>{row.original}</Line>
        {row.action === "revise" ? (
          <Line label="최소 첨삭">
            <MinimalDiff parts={row.diff} />
          </Line>
        ) : (
          <Line label="최소 첨삭" className="font-sans text-xs text-emerald-600 dark:text-emerald-400">✓ 고칠 곳이 없어요</Line>
        )}
        {(row.action === "revise" || recommendedDiffers) && (
          <Line label="추천" className={`${BLACK} font-bold`}>{row.recommended}</Line>
        )}
        <Note text={row.note} />
      </div>
    </li>
  );
}

function InsertRow({ row }: { row: Extract<ReviewRow, { kind: "insert" }> }) {
  return (
    <li className="print-avoid-break flex gap-3 py-3" data-testid="insert-row">
      <span className={`flex w-7 shrink-0 justify-end ${BLUE}`} aria-label="삽입">
        <Plus className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Line label="넣기" className={`${BLUE} font-bold`}>{row.sentence}</Line>
        <Note text={row.reason} blue />
      </div>
    </li>
  );
}

export function SentenceReviewView({ essay, review, no }: { essay: string; review: SentenceReviewData; no: string }) {
  const rows = useMemo(() => buildReviewRows(essay, review), [essay, review]);
  const count = (pred: (r: ReviewRow) => boolean) => rows.filter(pred).length;
  const revised = count((r) => r.kind === "sentence" && r.action === "revise");
  const deleted = count((r) => r.kind === "sentence" && r.action === "delete");
  const inserted = count((r) => r.kind === "insert");
  const total = count((r) => r.kind === "sentence");

  let lastParagraph = 0;
  return (
    <section>
      <SectionTitle no={no} title="문장별 첨삭" sub={`${total}문장 · 고칠 문장 ${revised} · 뺄 문장 ${deleted} · 넣을 문장 ${inserted}`} />
      <Card>
        <CardContent className="p-5">
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted px-3 py-2 text-xs" aria-label="표시 방법">
            <li><span className={BLACK}>학생 문장</span> = 내가 쓴 그대로</li>
            <li>
              최소 첨삭 = <span className={GREY}>그대로 둔 부분</span> + <span className={`${BLACK} font-semibold underline underline-offset-4`}>고친 부분</span> <del className={BLACK}>지운 부분</del>
            </li>
            <li><strong>추천 문장</strong> = 더 좋은 표현</li>
            <li className={BLUE}>파란색 = 넣거나 뺄 문장</li>
          </ul>
          <ol className="divide-y">
            {rows.map((row, i) => {
              const breakBefore = row.kind === "sentence" && row.paragraph !== lastParagraph && i > 0;
              if (row.kind === "sentence") lastParagraph = row.paragraph;
              return (
                <Fragment key={row.kind === "sentence" ? `s${row.no}` : `i${row.afterNo}-${i}`}>
                  {breakBefore && (
                    <li aria-hidden className="py-1 text-center text-[0.7rem] text-muted-foreground">
                      ── 문단 {row.kind === "sentence" ? row.paragraph + 1 : ""} ──
                    </li>
                  )}
                  {row.kind === "sentence" ? <SentenceRow row={row} /> : <InsertRow row={row} />}
                </Fragment>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
