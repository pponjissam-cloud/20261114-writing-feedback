import { describe, expect, it } from "vitest";
import { checkEssay, countWords, englishRatio } from "./essay";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("essay checks", () => {
  it("단어 수를 센다 (구두점만 있는 토큰 제외)", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  I think,  homework is bad .  ")).toBe(5);
    expect(countWords("don't well-known 2026")).toBe(3);
  });

  it("50단어 미만이면 차단한다", () => {
    const r = checkEssay(words(49));
    expect(r.ok).toBe(false);
    expect(checkEssay(words(50)).ok).toBe(true);
  });

  it("영어 비율이 낮으면 차단한다", () => {
    const korean = "나는 숙제가 나쁘다고 생각한다 ".repeat(20) + words(50);
    expect(englishRatio(korean)).toBeLessThan(0.8);
    const r = checkEssay(korean);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/영어 비율/);
  });

  it("영어 글에 한글이 조금 섞인 것은 허용한다", () => {
    expect(checkEssay(words(60) + " 김치").ok).toBe(true);
  });
});
