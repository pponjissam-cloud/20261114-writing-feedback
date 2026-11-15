import type { Feedback } from "@/lib/schema";

/** VITE_MOCK 모드와 테스트에서 쓰는 고정 샘플 응답 */
export const SAMPLE_FEEDBACK: Feedback = {
  scores: [
    { key: "claim", score: 12, rationale: "첫 문단에서 숙제에 반대한다는 입장을 분명하게 밝혔어요." },
    { key: "reasoning", score: 13, rationale: "이유 두 가지가 있지만 '왜 그런지' 설명이 조금 짧아요." },
    { key: "examples", score: 8, rationale: "구체적인 예시가 거의 없어서 설득력이 약해요." },
    { key: "counterargument", score: 5, rationale: "반대 의견을 다루지 않았어요." },
    { key: "organization", score: 11, rationale: "서론–본론–결론 구조가 있고 First, Second를 잘 썼어요." },
    { key: "language", score: 14, rationale: "주어와 동사 수 일치 실수가 몇 번 있지만 뜻은 잘 전달돼요." },
  ],
  overall: {
    strengths: [
      { point: "주장을 글의 처음에 분명하게 밝혔어요.", evidence: "I think homework is bad." },
      { point: "First, Second 같은 연결어로 이유를 순서대로 정리했어요.", evidence: "First," },
    ],
    weaknesses: [
      { point: "이유를 뒷받침하는 구체적인 예시가 부족해요.", evidence: "Students are tired." },
      { point: "반대 의견(숙제의 장점)을 소개하고 반박하는 부분이 없어요.", evidence: "In conclusion," },
    ],
  },
  structure: {
    parts: [
      { role: "claim", label: "서론·주장", fromNo: 1, toNo: 2, comment: "숙제에 반대한다는 입장이 처음부터 분명해요." },
      { role: "reason", label: "근거 1", fromNo: 3, toNo: 3, comment: "피곤하다는 이유만 있고 '왜' 피곤한지 설명이 짧아요." },
    ],
    missing: [
      { role: "example", afterNo: 3, suggestion: "근거 1 뒤에 '나는 숙제 때문에 6시간밖에 못 잔다'처럼 실제 경험이나 숫자를 넣어 보세요." },
      { role: "counterargument", afterNo: 3, suggestion: "결론 전에 '숙제가 복습에 도움이 된다'는 반대 의견을 소개하고 However로 반박해 보세요." },
    ],
    flowComment: "주장 → 근거 → 결론의 기본 틀은 있지만, 근거를 받쳐 줄 예시와 반대 의견 부분이 비어 있어요.",
  },
  sentenceReview: {
    items: [
      { no: 1, action: "revise", minimal: "Many people think homework is bad.", recommended: "Many people believe that homework does more harm than good.", note: "people은 여러 명이라 think를 써요." },
      { no: 2, action: "keep", minimal: "I think homework is bad too.", recommended: "I also believe that students should get less homework.", note: "" },
    ],
    insertions: [{ afterNo: 2, sentence: "For example, many students sleep less than six hours because of homework.", reason: "주장을 뒷받침하는 구체적인 예시가 있으면 더 설득력이 생겨요." }],
  },
  rewriteMission: {
    tasks: [
      {
        targetKey: "counterargument",
        instruction: "‘숙제가 공부 습관을 길러 준다’는 반대 의견을 한 문장으로 소개하고, 왜 그래도 숙제를 줄여야 하는지 한 문장으로 반박해 보세요.",
        selfCheck: ["Some people say… 로 반대 의견을 소개했나요?", "However, … 로 반박하는 이유를 썼나요?"],
      },
      {
        targetKey: "examples",
        instruction: "‘Students are tired.’ 뒤에 나 또는 친구의 실제 경험이나 숫자가 들어간 예시를 한 문장 추가해 보세요.",
        selfCheck: ["For example, 로 시작하는 문장을 넣었나요?", "숫자나 구체적인 상황이 들어 있나요?"],
      },
    ],
    teacherComment:
      "자신의 생각을 영어로 끝까지 써 낸 것이 정말 멋져요. 주장이 분명해서 읽는 사람이 무엇을 말하려는지 바로 알 수 있었어요. 다음에는 예시를 하나씩 더 붙여서 이유를 더 단단하게 만들어 봐요. 반대 의견까지 다루면 훨씬 설득력 있는 논설문이 될 거예요. 다음 글도 기대할게요!",
  },
};
