import { describe, expect, it, vi } from "vitest";
import { assertRubricTotal, compareScores, computeScores, rubricTotal, snapshotRubric, weakestKeys } from "./scoring";
import { RUBRIC } from "@/config/rubric";
import { SAMPLE_FEEDBACK } from "./llm/sampleFeedback";

describe("rubric", () => {
  it("기본 루브릭 합계는 100이다", () => {
    expect(rubricTotal()).toBe(100);
    expect(() => assertRubricTotal()).not.toThrow();
  });

  it("합계가 100이 아니면 오류를 던진다", () => {
    const bad = RUBRIC.map((r, i) => ({ ...r, max: i === 0 ? r.max + 5 : r.max }));
    expect(() => assertRubricTotal(bad)).toThrow(/105/);
  });

  it("중복 key 나 0점 배점을 거부한다", () => {
    const dup = [...RUBRIC.slice(0, 5), { ...RUBRIC[0]!, max: 20 }];
    expect(() => assertRubricTotal(dup)).toThrow(/중복/);
    const zero = RUBRIC.map((r, i) => ({ ...r, max: i === 0 ? 0 : i === 1 ? r.max + 15 : r.max }));
    expect(() => assertRubricTotal(zero)).toThrow(/양의 정수/);
  });
});

describe("computeScores", () => {
  it("항목 점수를 합산해 총점을 계산한다", () => {
    const s = computeScores(SAMPLE_FEEDBACK.scores, snapshotRubric(), () => {});
    expect(s.total).toBe(12 + 13 + 8 + 5 + 11 + 14);
    expect(s.maxTotal).toBe(100);
    expect(s.items.map((i) => i.key)).toEqual(RUBRIC.map((r) => r.key));
  });

  it("배점을 넘는 점수는 배점으로 clamp 하고 경고한다", () => {
    const warn = vi.fn();
    const scores = SAMPLE_FEEDBACK.scores.map((s) => (s.key === "claim" ? { ...s, score: 40 } : s));
    const s = computeScores(scores, snapshotRubric(), warn);
    const claim = s.items.find((i) => i.key === "claim")!;
    expect(claim.score).toBe(15);
    expect(claim.clamped).toBe(true);
    expect(s.total).toBe(15 + 13 + 8 + 5 + 11 + 14);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/claim/);
  });

  it("저장된 루브릭 스냅샷 기준으로 계산한다", () => {
    const snap = snapshotRubric().map((r) => ({ ...r, max: r.key === "claim" ? 10 : r.max }));
    const s = computeScores(SAMPLE_FEEDBACK.scores, snap, () => {});
    expect(s.items[0]!.score).toBe(10);
  });

  it("비율이 낮은 항목과 이전 점수와의 차이를 계산한다", () => {
    const a = computeScores(SAMPLE_FEEDBACK.scores, snapshotRubric(), () => {});
    expect(weakestKeys(a, 2)).toEqual(["counterargument", "examples"]);
    const better = computeScores(SAMPLE_FEEDBACK.scores.map((s) => ({ ...s, score: s.score + 1 })), snapshotRubric(), () => {});
    expect(compareScores(a, better).totalDiff).toBe(6);
  });
});
