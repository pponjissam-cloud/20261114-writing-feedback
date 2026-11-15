import { describe, expect, it } from "vitest";
import { buildStructureBlocks, structureFlow } from "./structure";

const essay = "Homework is bad. First, students are tired. For example, I sleep 5 hours. Second, no free time. In conclusion, less homework.";

describe("buildStructureBlocks", () => {
  it("문장 번호 범위로 블록을 만들고 빠진 구조를 제자리에 넣는다", () => {
    const blocks = buildStructureBlocks(essay, {
      parts: [
        { role: "claim", label: "서론·주장", fromNo: 1, toNo: 1, comment: "주장이 분명해요" },
        { role: "reason", label: "근거 1", fromNo: 2, toNo: 3, comment: "" },
        { role: "reason", label: "근거 2", fromNo: 4, toNo: 4, comment: "예시가 없어요" },
        { role: "conclusion", label: "결론", fromNo: 5, toNo: 9, comment: "" },
      ],
      missing: [
        { role: "counterargument", afterNo: 4, suggestion: "반대 의견 넣기" },
        { role: "example", afterNo: 2, suggestion: "블록 중간 → 블록 뒤로" },
      ],
      flowComment: "",
    });
    expect(blocks.map((b) => (b.kind === "part" ? `${b.label}:${b.sentences.map((s) => s.no).join(",")}` : `+${b.role}`))).toEqual([
      "서론·주장:1",
      "근거 1:2,3",
      "+example",
      "근거 2:4",
      "+counterargument",
      "결론:5",
    ]);
  });

  it("겹치면 앞 블록 우선, 빠진 문장은 기타로 묶는다", () => {
    const blocks = buildStructureBlocks(essay, {
      parts: [
        { role: "claim", label: "주장", fromNo: 1, toNo: 2, comment: "" },
        { role: "reason", label: "근거", fromNo: 2, toNo: 3, comment: "" },
      ],
      missing: [],
      flowComment: "",
    });
    expect(blocks.map((b) => (b.kind === "part" ? `${b.role}:${b.sentences.map((s) => s.no).join(",")}` : ""))).toEqual(["claim:1,2", "reason:3", "other:4,5"]);
    expect(blocks.flatMap((b) => (b.kind === "part" ? b.sentences : [])).length).toBe(5);
  });

  it("구조 정보가 없으면 전체가 기타 한 블록", () => {
    const blocks = buildStructureBlocks(essay, undefined);
    expect(blocks).toHaveLength(1);
  });

  it("흐름 요약에서 빠진 기본 뼈대를 찾는다", () => {
    const blocks = buildStructureBlocks(essay, {
      parts: [
        { role: "introduction", label: "서론", fromNo: 1, toNo: 1, comment: "" },
        { role: "reason", label: "근거", fromNo: 2, toNo: 4, comment: "" },
        { role: "conclusion", label: "결론", fromNo: 5, toNo: 5, comment: "" },
      ],
      missing: [],
      flowComment: "",
    });
    expect(structureFlow(blocks)).toEqual({ steps: ["서론", "근거", "결론"], absent: ["example", "counterargument", "rebuttal"] });
  });
});
