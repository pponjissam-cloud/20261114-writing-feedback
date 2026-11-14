import type { ModelId } from "@/config/models";
import type { RubricKey } from "@/config/rubric";
import type { CorrectionType, Feedback } from "@/lib/schema";
import { computeScores, snapshotRubric, type ScoreSummary } from "@/lib/scoring";
import type { StoredReport } from "@/lib/storage";
import type { PreviousAttempt } from "@/lib/llm/prompts";

export const CORRECTION_TYPE_LABEL: Record<CorrectionType, string> = {
  vocabulary: "어휘",
  grammar: "문법",
  expression: "표현",
  spelling: "철자",
};

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 저장 시점에 한 번만 점수를 계산(배점 초과 경고 로그 포함)하고 루브릭을 함께 보관한다 */
export function buildReport(input: {
  modelId: ModelId;
  topic: string;
  essay: string;
  feedback: Feedback;
  parent?: StoredReport | null;
  siblings?: StoredReport[];
  mock?: boolean;
  now?: number;
}): StoredReport {
  const rubric = snapshotRubric();
  const summary = computeScores(input.feedback.scores, rubric);
  const id = newId();
  const parent = input.parent ?? null;
  const groupId = parent?.groupId ?? id;
  const version = parent ? Math.max(parent.version, ...(input.siblings ?? []).filter((r) => r.groupId === groupId).map((r) => r.version)) + 1 : 1;
  return {
    id,
    createdAt: input.now ?? Date.now(),
    modelId: input.modelId,
    topic: input.topic.trim(),
    essay: input.essay,
    feedback: input.feedback,
    rubric,
    total: summary.total,
    groupId,
    parentId: parent?.id,
    version,
    mock: input.mock || undefined,
  };
}

export function summaryOf(report: StoredReport): ScoreSummary {
  return computeScores(report.feedback.scores, report.rubric, () => {});
}

export function previousAttemptOf(report: StoredReport): PreviousAttempt {
  return { essay: report.essay, feedback: report.feedback, rubric: report.rubric, total: report.total };
}

export function rubricLabel(report: StoredReport, key: RubricKey): string {
  return report.rubric.find((r) => r.key === key)?.label ?? key;
}
