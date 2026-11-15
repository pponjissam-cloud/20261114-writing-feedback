import { useMemo } from "react";
import type { EssayStructure } from "@/lib/schema";
import { buildStructureBlocks, ROLE_LABEL, structureFlow } from "@/lib/structure";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "./SectionTitle";

/** ③ 빨간펜 구조 분석 — 글 전체를 역할별로 묶어 빨간 괄호·코멘트로 표시하고, 빠진 구조를 짚어 준다 */
export function StructureView({ essay, structure, no = "③" }: { essay: string; structure?: EssayStructure; no?: string }) {
  const blocks = useMemo(() => buildStructureBlocks(essay, structure), [essay, structure]);
  const flow = useMemo(() => structureFlow(blocks), [blocks]);
  const missing = blocks.filter((b) => b.kind === "missing");
  let missingNo = 0;

  return (
    <section>
      <SectionTitle no={no} title="빨간펜 구조 분석" sub="글 전체의 짜임을 살펴봤어요" />
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 printing:gap-2 printing:p-3">
          {structure ? (
            <div className="flex flex-wrap items-center gap-1 text-xs" aria-label="글의 흐름">
              <span className="mr-1 font-medium text-muted-foreground">흐름</span>
              {flow.steps.map((s, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-redpen">→</span>}
                  <span className="rounded border border-redpen/60 px-1.5 py-0.5 text-redpen">{s}</span>
                </span>
              ))}
              {flow.absent.map((r) => (
                <span key={r} className="rounded border border-dashed border-redpen px-1.5 py-0.5 text-redpen/80 line-through decoration-redpen/60">
                  {ROLE_LABEL[r]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">이 리포트는 이전 형식이라 구조 분석이 없어요. 다시 제출하면 구조 분석을 받을 수 있어요.</p>
          )}

          <div className="flex flex-col gap-2" data-testid="structure-blocks">
            {blocks.map((b, i) => {
              if (b.kind === "missing") {
                missingNo++;
                return (
                  <div key={`m${i}`} className="ml-[5.5rem] rounded border border-dashed border-redpen px-2 py-1 font-essay text-sm italic text-redpen" data-testid="structure-missing">
                    ∨ 여기에 <strong className="not-italic">{ROLE_LABEL[b.role]}</strong>이(가) 필요해요 → 보완 {missingNo}
                  </div>
                );
              }
              return (
                <div key={`p${i}`} className="grid grid-cols-[5rem_1fr] gap-2">
                  <div className="border-r-2 border-redpen pr-2 text-right font-essay text-xs font-bold leading-5 text-redpen">{b.label}</div>
                  <div className="min-w-0">
                    <p className="font-essay text-[0.95rem] leading-6 printing:text-[0.9rem] printing:leading-5">
                      {b.sentences.map((s) => (
                        <span key={s.no}>
                          <sup className="mr-0.5 font-sans text-[0.6rem] text-muted-foreground">{s.no}</sup>
                          {s.text}{" "}
                        </span>
                      ))}
                    </p>
                    {b.comment && <p className="font-essay text-xs italic text-redpen">↳ {b.comment}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {structure && (structure.flowComment || missing.length > 0) && (
            <div className="rounded-md border-2 border-redpen/70 p-3 text-sm printing:p-2" data-testid="structure-fixes">
              <p className="mb-1 font-semibold text-redpen">구조적으로 보완할 점</p>
              {structure.flowComment && <p className="mb-1 text-xs">{structure.flowComment}</p>}
              {missing.length > 0 && (
                <ol className="flex flex-col gap-0.5 text-xs">
                  {missing.map((m, i) => (
                    <li key={i}>
                      <span className="font-bold text-redpen">보완 {i + 1}. {ROLE_LABEL[m.role]}</span> — {m.suggestion}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
