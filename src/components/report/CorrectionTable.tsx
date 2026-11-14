import { useState } from "react";
import type { CorrectionType, Feedback, RedPenItem } from "@/lib/schema";
import { CORRECTION_TYPE_LABEL } from "@/lib/report";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RedPenExplanation } from "./RedPenView";
import { SectionTitle } from "./SectionTitle";

type Filter = "all" | CorrectionType;
const TYPES = Object.keys(CORRECTION_TYPE_LABEL) as CorrectionType[];

export function CorrectionTable({ corrections, unmatchedRedPen }: { corrections: Feedback["corrections"]; unmatchedRedPen: RedPenItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = corrections.map((c, i) => ({ ...c, no: i + 1 })).filter((c) => filter === "all" || c.type === filter);
  const count = (t: Filter) => (t === "all" ? corrections.length : corrections.filter((c) => c.type === t).length);

  return (
    <section>
      <SectionTitle no="④" title="상세 정정 목록" />
      <Card>
        <CardContent className="p-5">
          <div className="no-print mb-3 flex flex-wrap gap-1.5" role="group" aria-label="유형 필터">
            {(["all", ...TYPES] as Filter[]).map((t) => (
              <Button key={t} size="sm" variant={filter === t ? "default" : "outline"} aria-pressed={filter === t} onClick={() => setFilter(t)}>
                {t === "all" ? "전체" : CORRECTION_TYPE_LABEL[t]} <span className="tabular-nums opacity-70">{count(t)}</span>
              </Button>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">번호</TableHead>
                <TableHead>원래 표현</TableHead>
                <TableHead>수정 표현</TableHead>
                <TableHead className="w-16">유형</TableHead>
                <TableHead>설명</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.no}>
                  <TableCell className="tabular-nums text-muted-foreground">{c.no}</TableCell>
                  <TableCell className="font-essay line-through decoration-redpen/70">{c.original}</TableCell>
                  <TableCell className="font-essay text-redpen">{c.corrected}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{CORRECTION_TYPE_LABEL[c.type]}</Badge>
                  </TableCell>
                  <TableCell className="min-w-48">{c.explanation}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    이 유형의 정정은 없어요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {unmatchedRedPen.length > 0 && (
            <div className="mt-5 border-t pt-4" data-testid="unmatched-redpen">
              <h3 className="mb-1 text-sm font-semibold">본문에 표시하지 못한 빨간펜 첨삭</h3>
              <p className="mb-3 text-xs text-muted-foreground">AI가 인용한 문장을 원문에서 정확히 찾지 못해 여기에만 보여 드려요.</p>
              <ul className="flex flex-col gap-3">
                {unmatchedRedPen.map((r) => (
                  <li key={r.id} className="print-avoid-break rounded-md border p-3 text-sm">
                    <p className="font-essay line-through decoration-redpen/70">{r.original}</p>
                    <p className="font-essay text-redpen">→ {r.revised}</p>
                    <div className="mt-2">
                      <RedPenExplanation item={r} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
