import { describe, expect, it } from "vitest";
import { buildReviewRows, numberedSentences } from "./sentenceReview";

const essay = "Many people thinks homework is bad. I agree. Homework is good for nothing.\n\nIn conclusion, less homework.";

describe("buildReviewRows", () => {
  it("모든 학생 문장을 번호 순서대로 한 줄씩 만들고, 삽입 문장을 제자리에 끼운다", () => {
    const rows = buildReviewRows(essay, {
      items: [
        { no: 1, action: "revise", minimal: "Many people think homework is bad.", recommended: "Many people believe homework is harmful.", note: "수 일치" },
        { no: 3, action: "delete", minimal: "", recommended: "", note: "주장과 반대" },
        { no: 1, action: "keep", minimal: "dup", recommended: "dup", note: "" },
        { no: 99, action: "revise", minimal: "x", recommended: "x", note: "" },
      ],
      insertions: [
        { afterNo: 2, sentence: "For example, I sleep only six hours.", reason: "예시" },
        { afterNo: 0, sentence: "Homework is a hot topic.", reason: "도입" },
        { afterNo: 50, sentence: "Thank you.", reason: "끝" },
      ],
    });
    expect(rows.map((r) => (r.kind === "sentence" ? `${r.no}:${r.action}` : `+${r.afterNo}`))).toEqual(["+0", "1:revise", "2:keep", "+2", "3:delete", "4:keep", "+4"]);
    const first = rows[1]!;
    if (first.kind !== "sentence") throw new Error();
    expect(first.diff.filter((d) => d.type === "add").map((d) => d.text.trim())).toEqual(["think"]);
    expect(first.recommended).toBe("Many people believe homework is harmful.");
  });

  it("AI 응답이 없거나(이전 리포트) 비어 있으면 모두 그대로 두기", () => {
    const rows = buildReviewRows(essay, undefined);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.kind === "sentence" && r.action === "keep" && r.minimal === r.original)).toBe(true);
  });

  it("revise 라고 했지만 바뀐 게 없으면 keep 으로 표시한다", () => {
    const rows = buildReviewRows("I agree.", { items: [{ no: 1, action: "revise", minimal: "I agree.", recommended: "I strongly agree.", note: "" }], insertions: [] });
    expect(rows[0]).toMatchObject({ action: "keep", recommended: "I strongly agree." });
  });

  it("프롬프트용 번호 목록", () => {
    expect(numberedSentences(essay).split("\n")[0]).toBe("[1] Many people thinks homework is bad.");
  });
});
