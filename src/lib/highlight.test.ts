import { describe, expect, it } from "vitest";
import { buildSegments } from "./highlight";

const TEXT = "Many people thinks homework is bad. Students are tired. Homework is bad.";

const join = (r: ReturnType<typeof buildSegments>) => r.segments.map((s) => s.text).join("");

describe("buildSegments", () => {
  it("일치하는 구간을 하이라이트하고 원문을 그대로 보존한다", () => {
    const r = buildSegments(TEXT, [{ id: "a", original: "Students are tired." }]);
    expect(join(r)).toBe(TEXT);
    expect(r.segments.map((s) => s.markId)).toEqual([undefined, "a", undefined]);
    expect(r.segments[1]).toMatchObject({ text: "Students are tired.", start: 36 });
    expect(r.matched).toEqual(["a"]);
  });

  it("글자 그대로 일치하지 않으면 하이라이트하지 않는다 (대소문자·공백·구두점 차이 포함)", () => {
    const r = buildSegments(TEXT, [
      { id: "a", original: "Many people think homework is bad." },
      { id: "b", original: "students are tired." },
      { id: "c", original: "Students  are tired." },
      { id: "d", original: "   " },
    ]);
    expect(r.matched).toEqual([]);
    expect(r.unmatched).toEqual([
      { id: "a", reason: "not_found" },
      { id: "b", reason: "not_found" },
      { id: "c", reason: "not_found" },
      { id: "d", reason: "empty" },
    ]);
    expect(r.segments).toEqual([{ text: TEXT, start: 0 }]);
  });

  it("원문에 여러 번 나오면 첫 번째 위치를 쓴다", () => {
    const r = buildSegments(TEXT, [{ id: "a", original: "is bad." }]);
    const hit = r.segments.find((s) => s.markId === "a")!;
    expect(hit.start).toBe(TEXT.indexOf("is bad."));
    expect(hit.start).toBeLessThan(TEXT.lastIndexOf("is bad."));
  });

  it("같은 발췌가 중복되면 뒤 항목은 하이라이트하지 않는다", () => {
    const r = buildSegments(TEXT, [
      { id: "a", original: "is bad." },
      { id: "b", original: "is bad." },
    ]);
    expect(r.matched).toEqual(["a"]);
    expect(r.unmatched).toEqual([{ id: "b", reason: "overlap" }]);
  });

  it("구간이 겹치면 앞 항목이 우선한다 (뒤 항목이 앞쪽에 있어도)", () => {
    const r = buildSegments(TEXT, [
      { id: "a", original: "homework is bad. Students" },
      { id: "b", original: "Many people thinks homework" },
      { id: "c", original: "are tired." },
    ]);
    expect(r.matched.sort()).toEqual(["a", "c"]);
    expect(r.unmatched).toEqual([{ id: "b", reason: "overlap" }]);
    expect(join(r)).toBe(TEXT);
  });

  it("맞닿은(겹치지 않는) 구간은 모두 하이라이트하고 위치 순으로 정렬한다", () => {
    const r = buildSegments("AB CD", [
      { id: "2", original: " CD" },
      { id: "1", original: "AB" },
    ]);
    expect(r.segments.map((s) => [s.text, s.markId])).toEqual([["AB", "1"], [" CD", "2"]]);
  });

  it("HTML 같은 문자열도 텍스트 그대로 다룬다", () => {
    const text = "I <b>love</b> & hate it.";
    const r = buildSegments(text, [{ id: "x", original: "<b>love</b>" }]);
    expect(r.segments[1]!.text).toBe("<b>love</b>");
  });
});
