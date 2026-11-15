import { describe, expect, it } from "vitest";
import { buildResponseSchema, parseFeedback } from "./schema";
import { SAMPLE_FEEDBACK } from "./llm/sampleFeedback";

const clone = () => structuredClone(SAMPLE_FEEDBACK) as unknown as Record<string, any>;

describe("parseFeedback", () => {
  it("정상 응답을 통과시킨다 (객체/문자열/코드펜스)", () => {
    expect(parseFeedback(SAMPLE_FEEDBACK).ok).toBe(true);
    expect(parseFeedback(JSON.stringify(SAMPLE_FEEDBACK)).ok).toBe(true);
    expect(parseFeedback("```json\n" + JSON.stringify(SAMPLE_FEEDBACK) + "\n```").ok).toBe(true);
  });

  it("이전 형식 필드(redPen·corrections)가 섞여 있어도 무시하고 통과한다", () => {
    const fb = clone();
    fb.redPen = [{ id: "r1" }];
    fb.corrections = [];
    const r = parseFeedback(fb);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).not.toHaveProperty("redPen");
  });

  it("JSON 이 아니면 실패한다", () => {
    const r = parseFeedback("{not json");
    expect(r.ok).toBe(false);
  });

  it("scores 가 6개가 아니면 실패한다", () => {
    const fb = clone();
    fb.scores.pop();
    expect(parseFeedback(fb).ok).toBe(false);
  });

  it("같은 항목 key 가 중복되면 실패한다", () => {
    const fb = clone();
    fb.scores[1].key = "claim";
    expect(parseFeedback(fb).ok).toBe(false);
  });

  it("음수/소수 점수, 잘못된 key, 잘못된 구조 역할·문장 동작을 거부한다", () => {
    const neg = clone(); neg.scores[0].score = -1;
    const frac = clone(); frac.scores[0].score = 3.5;
    const badKey = clone(); badKey.scores[0].key = "creativity";
    const badRole = clone(); badRole.structure.parts[0].role = "hook";
    const badAction = clone(); badAction.sentenceReview.items[0].action = "rewrite";
    const noStructure = clone(); delete noStructure.structure;
    for (const fb of [neg, frac, badKey, badRole, badAction, noStructure]) expect(parseFeedback(fb).ok).toBe(false);
  });

  it("strengths 개수(2~4)와 tasks 개수(2~3), selfCheck 개수(2~4)를 검사한다", () => {
    const s = clone(); s.overall.strengths = [s.overall.strengths[0]];
    const t = clone(); t.rewriteMission.tasks = [t.rewriteMission.tasks[0]];
    const c = clone(); c.rewriteMission.tasks[0].selfCheck = ["a", "b", "c", "d", "e"];
    for (const fb of [s, t, c]) expect(parseFeedback(fb).ok).toBe(false);
  });

  it("필수 필드 누락 시 실패한다", () => {
    const fb = clone();
    delete fb.rewriteMission.teacherComment;
    expect(parseFeedback(fb).ok).toBe(false);
  });
});

describe("buildResponseSchema", () => {
  const schema = buildResponseSchema();

  it("Gemini 형식(대문자 type, propertyOrdering)으로 변환된다", () => {
    expect(schema.type).toBe("OBJECT");
    expect(schema.propertyOrdering).toEqual(["scores", "overall", "structure", "sentenceReview", "rewriteMission"]);
    expect(schema.properties?.scores?.minItems).toBe("6");
    expect(schema.properties?.scores?.items?.properties?.score?.type).toBe("INTEGER");
    expect(schema.properties?.scores?.items?.properties?.key?.enum).toContain("counterargument");
  });

  it("구조 분석 스키마가 포함된다", () => {
    const parts = schema.properties?.structure?.properties?.parts?.items;
    expect(parts?.required).toEqual(["role", "label", "fromNo", "toNo", "comment"]);
    expect(parts?.properties?.role?.enum).toContain("counterargument");
  });

  it("Gemini 가 지원하지 않는 키를 포함하지 않는다", () => {
    const text = JSON.stringify(schema);
    expect(text).not.toMatch(/additionalProperties|\$schema|\$ref|"default"/);
  });
});
