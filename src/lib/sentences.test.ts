import { describe, expect, it } from "vitest";
import { splitSentences } from "./sentences";
import { diffWords, hasChanges } from "./diff";

describe("splitSentences", () => {
  it("문장과 문단을 나누고 번호를 붙인다", () => {
    const text = "Many people thinks homework is bad. I agree!\n\nWhy? Because students are tired.";
    const s = splitSentences(text);
    expect(s.map((x) => x.text)).toEqual(["Many people thinks homework is bad.", "I agree!", "Why?", "Because students are tired."]);
    expect(s.map((x) => x.no)).toEqual([1, 2, 3, 4]);
    expect(s.map((x) => x.paragraph)).toEqual([0, 0, 1, 1]);
    for (const x of s) expect(text.slice(x.start, x.start + x.text.length)).toBe(x.text);
  });

  it("약어·소수점·따옴표에서 잘못 끊지 않는다", () => {
    const s = splitSentences('Dr. Kim said "homework is useful." It costs 2.5 hours, e.g. after school. Mr. Lee agrees.');
    expect(s.map((x) => x.text)).toEqual(['Dr. Kim said "homework is useful."', "It costs 2.5 hours, e.g. after school.", "Mr. Lee agrees."]);
  });

  it("마침표 없는 마지막 문장과 문단 안 줄바꿈을 처리한다", () => {
    const s = splitSentences("Students need\nrest. I think so\n\n\n");
    expect(s.map((x) => x.text)).toEqual(["Students need rest.", "I think so"]);
  });

  it("빈 글은 빈 목록", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("diffWords", () => {
  it("바뀐 단어만 add/del 로 표시한다", () => {
    const d = diffWords("Many people thinks homework is bad.", "Many people think homework is harmful.");
    expect(d.filter((p) => p.type === "del").map((p) => p.text.trim())).toEqual(["thinks", "bad"]);
    expect(d.filter((p) => p.type === "add").map((p) => p.text.trim())).toEqual(["think", "harmful"]);
    expect(d.filter((p) => p.type !== "del").map((p) => p.text).join("")).toBe("Many people think homework is harmful.");
    expect(d.filter((p) => p.type !== "add").map((p) => p.text).join("")).toBe("Many people thinks homework is bad.");
  });

  it("같으면 변경 없음", () => {
    expect(hasChanges(diffWords("I agree.", "I agree."))).toBe(false);
    expect(hasChanges(diffWords("I agree", "I agree."))).toBe(true);
  });
});
