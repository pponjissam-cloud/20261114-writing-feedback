import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { buildSegments } from "@/lib/highlight";
import type { RedPenItem } from "@/lib/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectionTitle } from "./SectionTitle";

export function useRedPenLayout(essay: string, redPen: RedPenItem[]) {
  return useMemo(() => {
    const result = buildSegments(essay, redPen);
    const numberOf = new Map(result.matched.map((id) => [id, 0]));
    // 번호는 본문에 나오는 순서대로
    let n = 0;
    for (const seg of result.segments) if (seg.markId) numberOf.set(seg.markId, ++n);
    const unmatchedIds = new Set(result.unmatched.map((u) => u.id));
    return { ...result, numberOf, unmatchedItems: redPen.filter((r) => unmatchedIds.has(r.id)) };
  }, [essay, redPen]);
}

function Explanation({ item }: { item: RedPenItem }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>{item.reason}</p>
      {item.suggestedAddition && (
        <div className="rounded-md bg-amber-50 p-2 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold">
            <Lightbulb className="size-3.5" aria-hidden /> 이런 예시를 추가해 보세요
          </p>
          <p className="font-essay">{item.suggestedAddition}</p>
        </div>
      )}
    </div>
  );
}

export function RedPenView({ essay, redPen }: { essay: string; redPen: RedPenItem[] }) {
  const layout = useRedPenLayout(essay, redPen);
  const byId = new Map(redPen.map((r) => [r.id, r]));
  const ordered = layout.segments.filter((s) => s.markId).map((s) => byId.get(s.markId!)!);

  return (
    <section>
      <SectionTitle no="③" title="빨간펜 첨삭" sub="빨간 글씨를 누르면 이유를 볼 수 있어요" />
      <Card className="overflow-hidden">
        {/* 공책 줄: 줄 간격(leading-8 = 2rem)과 패딩만큼 배경을 맞춘다 */}
        <CardContent className="bg-[repeating-linear-gradient(transparent,transparent_1.95rem,var(--border)_1.95rem,var(--border)_2rem)] [background-position:0_1.25rem] p-5 sm:p-7 sm:[background-position:0_1.75rem] print:bg-none">
          <div className="whitespace-pre-wrap font-essay text-[1.05rem] leading-8" data-testid="redpen-text">
            {layout.segments.map((seg) => {
              const item = seg.markId ? byId.get(seg.markId) : undefined;
              if (!item) return <span key={seg.start}>{seg.text}</span>;
              const no = layout.numberOf.get(item.id);
              return (
                <Popover key={seg.start}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="cursor-pointer rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-redpen/60"
                      aria-label={`첨삭 ${no}: ${item.revised} — 이유 보기`}
                    >
                      <del className="decoration-redpen decoration-2 text-foreground/70">{seg.text}</del>
                      <sup className="mx-0.5 font-sans text-[0.65rem] font-bold text-redpen">{no}</sup>
                      <ins className="no-underline text-redpen [font-style:italic]"> {item.revised}</ins>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <p className="mb-2 text-xs font-semibold text-redpen">첨삭 {no}</p>
                    <Explanation item={item} />
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>

          {ordered.length > 0 && (
            <ol className="print-only mt-6 border-t pt-3 text-sm" aria-label="첨삭 이유">
              {ordered.map((item, i) => (
                <li key={item.id} className="print-avoid-break mb-2">
                  <span className="font-bold text-redpen">{i + 1}. </span>
                  {item.reason}
                  {item.suggestedAddition && <span className="block pl-4 font-essay text-muted-foreground">+ {item.suggestedAddition}</span>}
                </li>
              ))}
            </ol>
          )}
          {redPen.length === 0 && <p className="text-sm text-muted-foreground">고칠 부분이 거의 없어요. 훌륭해요!</p>}
        </CardContent>
      </Card>
    </section>
  );
}

export { Explanation as RedPenExplanation };
