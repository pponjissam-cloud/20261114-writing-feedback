import type { EssayStructure, StructureRole } from "@/lib/schema";
import { splitSentences, type Sentence } from "@/lib/sentences";

export const ROLE_LABEL: Record<StructureRole, string> = {
  introduction: "서론",
  claim: "주장",
  reason: "근거",
  example: "예시",
  counterargument: "반대 의견",
  rebuttal: "반박",
  conclusion: "결론",
  other: "기타",
};

/** 논설문이 갖춰야 할 기본 뼈대 (흐름 요약에서 빠진 칸을 보여 주는 기준) */
export const ESSENTIAL_ROLES: StructureRole[] = ["claim", "reason", "example", "counterargument", "rebuttal", "conclusion"];

export type StructureBlock =
  | { kind: "part"; role: StructureRole; label: string; comment: string; sentences: Sentence[] }
  | { kind: "missing"; role: StructureRole; suggestion: string; afterNo: number };

/**
 * AI가 준 구조(문장 번호 범위)를 코드가 나눈 문장에 맞춰 블록으로 만든다.
 * - 모든 문장이 정확히 한 블록에 들어간다 (겹치면 앞 블록 우선, 빠진 문장은 "기타")
 * - 빠진 구조 표시는 해당 문장이 속한 블록이 끝난 뒤에 넣어 블록이 쪼개지지 않게 한다
 */
export function buildStructureBlocks(essay: string, structure: EssayStructure | undefined): StructureBlock[] {
  const sentences = splitSentences(essay);
  const n = sentences.length;
  const owner = new Array<number>(n + 1).fill(-1);
  const parts = (structure?.parts ?? []).map((p) => ({ ...p, fromNo: Math.max(1, p.fromNo), toNo: Math.min(n, Math.max(p.fromNo, p.toNo)) }));
  parts.forEach((p, i) => {
    for (let k = p.fromNo; k <= p.toNo; k++) if (owner[k] === -1) owner[k] = i;
  });

  const parts2: StructureBlock[] = [];
  let k = 1;
  while (k <= n) {
    const o = owner[k]!;
    const run: Sentence[] = [];
    while (k <= n && owner[k] === o) run.push(sentences[k - 1]!), k++;
    if (o === -1) parts2.push({ kind: "part", role: "other", label: ROLE_LABEL.other, comment: "", sentences: run });
    else {
      const p = parts[o]!;
      parts2.push({ kind: "part", role: p.role, label: p.label.trim() || ROLE_LABEL[p.role], comment: p.comment, sentences: run });
    }
  }

  const missing = [...(structure?.missing ?? [])].sort((a, b) => a.afterNo - b.afterNo);
  const out: StructureBlock[] = [];
  const emit = (upTo: number) => {
    while (missing.length && missing[0]!.afterNo <= upTo) {
      const m = missing.shift()!;
      out.push({ kind: "missing", role: m.role, suggestion: m.suggestion, afterNo: m.afterNo });
    }
  };
  emit(0);
  for (const b of parts2) {
    out.push(b);
    if (b.kind === "part") emit(b.sentences[b.sentences.length - 1]!.no);
  }
  emit(Number.POSITIVE_INFINITY);
  return out;
}

/** 흐름 요약: 실제 등장 순서 + 기본 뼈대 중 빠진 역할 */
export function structureFlow(blocks: StructureBlock[]) {
  const present = blocks.filter((b): b is Extract<StructureBlock, { kind: "part" }> => b.kind === "part" && b.role !== "other");
  const roles = new Set(present.map((b) => b.role));
  const absent = ESSENTIAL_ROLES.filter((r) => !roles.has(r) && !(r === "claim" && roles.has("introduction")));
  return { steps: present.map((b) => b.label), absent };
}
