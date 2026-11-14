import { describe, expect, it, vi } from "vitest";
import { buildReport, summaryOf } from "./report";
import { SAMPLE_FEEDBACK } from "./llm/sampleFeedback";
import { createReportStore, memoryRepo } from "./storage";

describe("buildReport / reportStore", () => {
  it("Rewrite 버전을 같은 그룹으로 묶고 버전을 올린다", () => {
    const first = buildReport({ modelId: "gemini-3.5-flash-lite", topic: "T", essay: "E", feedback: SAMPLE_FEEDBACK });
    expect(first.version).toBe(1);
    expect(first.groupId).toBe(first.id);
    expect(first.total).toBe(63);
    const second = buildReport({ modelId: "gemini-3.5-flash-lite", topic: "T", essay: "E2", feedback: SAMPLE_FEEDBACK, parent: first, siblings: [first] });
    expect(second).toMatchObject({ groupId: first.id, parentId: first.id, version: 2 });
  });

  it("배점 초과 시 저장 시점에만 경고를 남긴다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fb = { ...SAMPLE_FEEDBACK, scores: SAMPLE_FEEDBACK.scores.map((s) => (s.key === "claim" ? { ...s, score: 99 } : s)) };
    const r = buildReport({ modelId: "gemini-3.5-flash-lite", topic: "T", essay: "E", feedback: fb });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(r.total).toBe(15 + 13 + 8 + 5 + 11 + 14);
    summaryOf(r);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("내보내기/가져오기, 삭제 시 체크리스트도 지운다", () => {
    const store = createReportStore(memoryRepo());
    const r = buildReport({ modelId: "gemini-3.5-flash-lite", topic: "T", essay: "E", feedback: SAMPLE_FEEDBACK });
    store.save(r);
    store.setChecklist(r.id, [[true, false]]);
    const dump = JSON.parse(JSON.stringify(store.exportAll()));
    expect(JSON.stringify(dump)).not.toMatch(/apiKey|quota/);

    const other = createReportStore(memoryRepo());
    expect(other.importAll(dump)).toEqual({ added: 1, updated: 0 });
    expect(other.importAll(dump)).toEqual({ added: 0, updated: 1 });
    expect(other.getChecklist(r.id)).toEqual([[true, false]]);
    expect(() => other.importAll({ app: "x" })).toThrow();

    other.remove(r.id);
    expect(other.list()).toHaveLength(0);
    expect(other.getChecklist(r.id)).toEqual([]);
  });
});
