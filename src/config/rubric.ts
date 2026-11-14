/**
 * 채점 루브릭 — 배점(max)을 바꾸려면 이 파일만 수정하세요. 합계는 반드시 100이어야 합니다.
 * (앱 시작 시 및 테스트에서 assertRubricTotal 로 검증)
 */
export const RUBRIC_KEYS = [
  "claim",
  "reasoning",
  "examples",
  "counterargument",
  "organization",
  "language",
] as const;

export type RubricKey = (typeof RUBRIC_KEYS)[number];

export interface RubricItem {
  key: RubricKey;
  label: string;
  max: number;
  /** 프롬프트에 들어가는 상/중/하 채점 기준 */
  criteria: { high: string; mid: string; low: string };
}

export const RUBRIC: readonly RubricItem[] = [
  {
    key: "claim",
    label: "주장",
    max: 15,
    criteria: {
      high: "The position on the topic is clear, specific, and stated early (usually in the introduction). It stays consistent to the end.",
      mid: "A position exists but is vague, too general, or appears late / shifts slightly.",
      low: "No clear position, or the essay argues both sides without choosing.",
    },
  },
  {
    key: "reasoning",
    label: "근거",
    max: 20,
    criteria: {
      high: "Two or more relevant, logical reasons that directly support the claim, each explained (why/how).",
      mid: "Reasons are given but some are weak, repetitive, off-topic, or not explained.",
      low: "Few or no reasons; mostly opinion repeated without support.",
    },
  },
  {
    key: "examples",
    label: "구체적 예시",
    max: 15,
    criteria: {
      high: "Specific examples, facts, experiences, or data clearly linked to each reason.",
      mid: "Some examples, but general (e.g., 'many people say') or not clearly connected.",
      low: "No examples, or examples unrelated to the reasons.",
    },
  },
  {
    key: "counterargument",
    label: "반대 의견",
    max: 15,
    criteria: {
      high: "Fairly presents an opposing view and rebuts it with a reason.",
      mid: "Mentions an opposing view but the rebuttal is missing or weak.",
      low: "Does not consider any opposing view.",
    },
  },
  {
    key: "organization",
    label: "구성 및 연결",
    max: 15,
    criteria: {
      high: "Clear introduction–body–conclusion, one main idea per paragraph, smooth transitions (First, In addition, However, Therefore).",
      mid: "Basic structure exists but paragraphs mix ideas or transitions are few/repetitive.",
      low: "Hard to follow; no paragraphing or logical order.",
    },
  },
  {
    key: "language",
    label: "문법 및 어휘",
    max: 20,
    criteria: {
      high: "Few errors that do not affect meaning; varied, appropriate vocabulary and sentence types for the student's level.",
      mid: "Several errors (agreement, tense, articles, word choice) but meaning is mostly clear.",
      low: "Frequent errors that often make meaning unclear.",
    },
  },
];

export function getRubricItem(key: RubricKey, rubric: readonly RubricItem[] = RUBRIC): RubricItem {
  const item = rubric.find((r) => r.key === key);
  if (!item) throw new Error(`Unknown rubric key: ${key}`);
  return item;
}
