import { RUBRIC, type RubricItem, type RubricKey } from "@/config/rubric";
import type { Feedback } from "@/lib/schema";

export interface ScoredItem {
  key: RubricKey;
  label: string;
  score: number;
  max: number;
  ratio: number;
  rationale: string;
  clamped: boolean;
}

export interface ScoreSummary {
  items: ScoredItem[];
  total: number;
  maxTotal: number;
}

export function rubricTotal(rubric: readonly Pick<RubricItem, "max">[] = RUBRIC): number {
  return rubric.reduce((sum, r) => sum + r.max, 0);
}

export function assertRubricTotal(rubric: readonly Pick<RubricItem, "key" | "max">[] = RUBRIC): void {
  const total = rubricTotal(rubric);
  if (total !== 100) throw new Error(`루브릭 배점 합계가 100이 아닙니다 (현재 ${total}). src/config/rubric.ts 를 확인하세요.`);
  if (rubric.some((r) => !Number.isInteger(r.max) || r.max <= 0)) {
    throw new Error("루브릭 배점은 양의 정수여야 합니다.");
  }
  if (new Set(rubric.map((r) => r.key)).size !== rubric.length) throw new Error("루브릭 항목 key가 중복되었습니다.");
}

export type RubricSnapshot = { key: RubricKey; label: string; max: number }[];

export function snapshotRubric(rubric: readonly RubricItem[] = RUBRIC): RubricSnapshot {
  return rubric.map(({ key, label, max }) => ({ key, label, max }));
}

/**
 * 총점은 AI가 준 총점이 아니라 항목 점수 합산으로만 계산한다 (AI 산술 오류 방지).
 * 배점을 넘는 점수는 배점으로 잘라낸다.
 */
export function computeScores(
  scores: Feedback["scores"],
  rubric: RubricSnapshot = snapshotRubric(),
  warn: (msg: string) => void = (m) => console.warn(m),
): ScoreSummary {
  const items: ScoredItem[] = rubric.map((r) => {
    const raw = scores.find((s) => s.key === r.key);
    const rawScore = raw ? Math.round(raw.score) : 0;
    let score = Math.max(0, rawScore);
    let clamped = false;
    if (score > r.max) {
      warn(`[scoring] '${r.key}' 점수 ${rawScore}점이 배점 ${r.max}점을 초과하여 ${r.max}점으로 조정했습니다.`);
      score = r.max;
      clamped = true;
    }
    if (!raw) warn(`[scoring] '${r.key}' 점수가 응답에 없어 0점 처리했습니다.`);
    return { key: r.key, label: r.label, score, max: r.max, ratio: r.max ? score / r.max : 0, rationale: raw?.rationale ?? "", clamped };
  });
  return {
    items,
    total: items.reduce((sum, i) => sum + i.score, 0),
    maxTotal: rubric.reduce((sum, r) => sum + r.max, 0),
  };
}

/** 점수 비율이 낮은 순 (Rewrite 미션 우선순위 표시용) */
export function weakestKeys(summary: ScoreSummary, n = 3): RubricKey[] {
  return [...summary.items].sort((a, b) => a.ratio - b.ratio).slice(0, n).map((i) => i.key);
}

export function compareScores(prev: ScoreSummary, next: ScoreSummary) {
  return {
    totalDiff: next.total - prev.total,
    items: next.items.map((i) => ({ key: i.key, label: i.label, diff: i.score - (prev.items.find((p) => p.key === i.key)?.score ?? 0) })),
  };
}
